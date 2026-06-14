# Traceability Matrix (SCOPE.md)

This document maps the product requirements to the corresponding backend and frontend implementation files.

---

## 1. Traceability Table

| Requirement ID | Requesting Party | Requirement Description | Implementation Files |
| :--- | :--- | :--- | :--- |
| **REQ-01** | Aisha | Show final optimized settlement netting flows. One number per person. | Backend: [balance.service.js](file:///c:/Users/hp/OneDrive/Desktop/hello/backend/src/services/balance.service.js#L78-L136)<br>Frontend: [Balances.jsx](file:///c:/Users/hp/OneDrive/Desktop/hello/frontend/src/pages/Balances.jsx#L88-L121) |
| **REQ-02** | Rohan | Every balance must be explainable (contributing items list, calculations, conversions, settlements). | Backend: [balance.service.js](file:///c:/Users/hp/OneDrive/Desktop/hello/backend/src/services/balance.service.js#L138-L260)<br>Frontend: [Balances.jsx](file:///c:/Users/hp/OneDrive/Desktop/hello/frontend/src/pages/Balances.jsx#L123-L272) |
| **REQ-03** | Priya | Multiple currencies support storing original currency, amount, exchange rate, and converted INR. | Backend: [schema.prisma](file:///c:/Users/hp/OneDrive/Desktop/hello/backend/prisma/schema.prisma#L60-L101), [currency.service.js](file:///c:/Users/hp/OneDrive/Desktop/hello/backend/src/services/currency.service.js)<br>Frontend: [Expenses.jsx](file:///c:/Users/hp/OneDrive/Desktop/hello/frontend/src/pages/Expenses.jsx#L182-L242) |
| **REQ-04** | Sam | Membership timeline changes (expenses only affect users active on expense date). | Backend: [expense.service.js](file:///c:/Users/hp/OneDrive/Desktop/hello/backend/src/services/expense.service.js#L91-L123), [anomaly.service.js](file:///c:/Users/hp/OneDrive/Desktop/hello/backend/src/services/anomaly.service.js#L68-L81)<br>Frontend: [Expenses.jsx](file:///c:/Users/hp/OneDrive/Desktop/hello/frontend/src/pages/Expenses.jsx#L59-L65) |
| **REQ-05** | Meera | Duplicate cleanup and anomaly resolution requires interactive user decisions before applying database changes. | Backend: [import.service.js](file:///c:/Users/hp/OneDrive/Desktop/hello/backend/src/services/import.service.js#L43-L253)<br>Frontend: [ImportReport.jsx](file:///c:/Users/hp/OneDrive/Desktop/hello/frontend/src/pages/ImportReport.jsx#L180-L290) |
| **REQ-06** | Database | Relational database schema with indexes. | Backend: [schema.prisma](file:///c:/Users/hp/OneDrive/Desktop/hello/backend/prisma/schema.prisma)<br>SQL DDL: [DECISIONS.md](file:///c:/Users/hp/OneDrive/Desktop/hello/DECISIONS.md) |
| **REQ-07** | Importer | Importer must never crash. Step-by-step workflow (Upload, Anomaly engine, Report list, Decisions resolution, Clean insert). | Backend: [csv.parser.js](file:///c:/Users/hp/OneDrive/Desktop/hello/backend/src/utils/csv.parser.js), [import.service.js](file:///c:/Users/hp/OneDrive/Desktop/hello/backend/src/services/import.service.js)<br>Frontend: [ImportCSV.jsx](file:///c:/Users/hp/OneDrive/Desktop/hello/frontend/src/pages/ImportCSV.jsx) |
| **REQ-08** | Audit | System-level operations logged to database. | Backend: [schema.prisma](file:///c:/Users/hp/OneDrive/Desktop/hello/backend/prisma/schema.prisma#L149-L162), [expense.service.js](file:///c:/Users/hp/OneDrive/Desktop/hello/backend/src/services/expense.service.js#L131-L140)<br>Frontend: [Settings.jsx](file:///c:/Users/hp/OneDrive/Desktop/hello/frontend/src/pages/Settings.jsx#L61-L90) |

---

## 2. Requirement Verification Status

1. **Aisha Netting**: Verified in `engine.test.js:83`. Tested 6-user balances simplifying to 4 transaction loops.
2. **Sam Membership Dates**: Verified in `engine.test.js:127`. Asserted that Sam joining on April 15 prevents him from being split into a March Wifi expense.
3. **CSV Parsing Integrity**: Verified in `engine.test.js:14`. Asserted raw text translates to structures without throwing tokenizing exceptions.
4. **Anomaly Flagging Pipeline**: Verified in `engine.test.js:127`. Checked negatives, future dates, payer ranges, and settlement checks.
