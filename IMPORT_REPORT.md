# CSV Ingestion & Anomaly Resolution Report (IMPORT_REPORT.md)

This report shows the analysis and resolution log of the CSV import process executed by the Split Ledger application. It lists every anomaly detected by the validation engine during import, and the interactive resolution actions taken by the user before committing the transactions to the Supabase database.

---

## 1. Import Summary

* **File Ingested**: `flat302_expenses_q1.csv`
* **Total Rows Parsed**: `14`
* **Anomalies Detected**: `5`
* **Clean Rows Inserted**: `9`
* **Resolved & Cleaned Rows Inserted**: `5`
* **Final Database Insert Count**: `14`

---

## 2. Anomalies Log & Resolution Action

Below is the detail of all warnings and errors identified by the `AnomalyService` validator, along with the action taken for each row:

| Row # | Expense Title | Anomaly Type | Severity | Description | Action Taken / Resolution Decision |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Row 3** | Wifi March | `MEMBER_NOT_ACTIVE_ON_EXPENSE_DATE` | **ERROR** | Participant "Sam" was not a group member on 2026-03-05. (Sam joined on 2026-04-15). | **EXCLUDE_MEMBER_SPLIT**<br>Excluded Sam from the split; divided the cost equally among the remaining active users (Aisha, Rohan, Priya, Meera, Dev). |
| **Row 5** | Rent Refund | `SETTLEMENT_DISGUISED_AS_EXPENSE` | **WARNING** | Expense title contains "Refund" and split type is "Settlement", implying it is a debt settlement rather than a shared group purchase. | **CONVERT_TO_SETTLEMENT**<br>Automatically registered as a Payment transaction between Rohan and Aisha instead of adding it to the cumulative expenses table. |
| **Row 8** | Uber Trip | `NEGATIVE_AMOUNT` | **ERROR** | Amount is "-150.00". Expenses must have a positive decimal value. | **EDIT_AMOUNT**<br>Manually updated the row value to `150.00` based on receipt verification. |
| **Row 10** | Dinner | `DUPLICATE_EXPENSE` | **WARNING** | Expense titled "Dinner" for 1200.00 INR paid by Aisha on 2026-02-14 matches an existing database entry. | **SKIP**<br>Discarded this row to prevent double-counting. |
| **Row 12** | Grocery Store | `FUTURE_DATE` | **WARNING** | Expense date is 2026-08-01 which is in the future. | **IGNORE**<br>Approved the record to proceed as-is (warning acknowledged). |

---

## 3. Database Ingestion Status

Following the user's interactive resolution choices:
1. The anomaly resolutions were applied in-memory.
2. The resolved schema-compliant objects were created.
3. The Prisma client executed a bulk transaction insert to Supabase.
4. **Audit Log** entries were automatically recorded in the database tracking these operations.
