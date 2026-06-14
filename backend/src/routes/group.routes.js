import express from 'express';
import prisma from '../db/prisma.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// List all groups user is member of
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const memberships = await prisma.groupMembership.findMany({
      where: {
        userId: req.user.id,
      },
      include: {
        group: {
          include: {
            memberships: {
              include: { user: true }
            }
          }
        }
      }
    });

    const groups = memberships.map(m => m.group);
    res.json(groups);
  } catch (error) {
    next(error);
  }
});

// Create Group
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const group = await prisma.$transaction(async (tx) => {
      const g = await tx.group.create({
        data: { name, description }
      });

      // Creator automatically becomes a member
      await tx.groupMembership.create({
        data: {
          groupId: g.id,
          userId: req.user.id,
          joinedAt: new Date()
        }
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CREATE_GROUP',
          entityType: 'GROUP',
          entityId: g.id,
          newValue: JSON.stringify(g)
        }
      });

      return g;
    });

    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
});

// Get Group Members
router.get('/:groupId/members', authenticateToken, async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const memberships = await prisma.groupMembership.findMany({
      where: { groupId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { joinedAt: 'asc' }
    });

    res.json(memberships);
  } catch (error) {
    next(error);
  }
});

// Add member to group
router.post('/:groupId/members', authenticateToken, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { email, joinedAt } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Member email is required' });
    }

    // Find user in system
    const userToAdd = await prisma.user.findUnique({ where: { email } });
    if (!userToAdd) {
      return res.status(404).json({ error: `User with email ${email} not registered in application.` });
    }

    // Check if already member
    const existingMembership = await prisma.groupMembership.findFirst({
      where: {
        groupId,
        userId: userToAdd.id,
        leftAt: null // active membership check
      }
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'User is already an active member of this group.' });
    }

    const membershipDate = joinedAt ? new Date(joinedAt) : new Date();

    const newMembership = await prisma.$transaction(async (tx) => {
      const m = await tx.groupMembership.create({
        data: {
          groupId,
          userId: userToAdd.id,
          joinedAt: membershipDate
        },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'ADD_MEMBER',
          entityType: 'GROUP_MEMBERSHIP',
          entityId: m.id,
          newValue: JSON.stringify(m)
        }
      });

      return m;
    });

    res.status(201).json(newMembership);
  } catch (error) {
    next(error);
  }
});

// Remove / Soft-leave user from group (timeline requirement)
router.delete('/:groupId/members/:userId', authenticateToken, async (req, res, next) => {
  try {
    const { groupId, userId } = req.params;
    const { leftAt } = req.body; // allow user to specify exact leave date

    // Find active membership
    const membership = await prisma.groupMembership.findFirst({
      where: {
        groupId,
        userId,
        leftAt: null
      }
    });

    if (!membership) {
      return res.status(404).json({ error: 'Active group membership not found for this user.' });
    }

    const leaveDate = leftAt ? new Date(leftAt) : new Date();
    if (leaveDate < membership.joinedAt) {
      return res.status(400).json({ error: 'Leave date cannot be before joining date.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.groupMembership.update({
        where: { id: membership.id },
        data: { leftAt: leaveDate }
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'REMOVE_MEMBER',
          entityType: 'GROUP_MEMBERSHIP',
          entityId: membership.id,
          oldValue: JSON.stringify(membership),
          newValue: JSON.stringify(u)
        }
      });

      return u;
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
