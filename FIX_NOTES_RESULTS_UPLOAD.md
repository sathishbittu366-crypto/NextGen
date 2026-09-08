# Fix: Notes upload / Results upload lastrowid crash

Root cause:
`sms_app/services/learning_service.py` was reading `c.lastrowid` from the pooled connection wrapper.
The wrapper exposes `lastrowid` on the cursor returned by `c.execute(...)`, not on the connection.

Fixed both affected inserts:
- Notes: use `cur = c.execute(...); note_id = cur.lastrowid`
- Result batch: use `batch_cur = c.execute(...); batch_id = int(batch_cur.lastrowid)`

No database schema change was made.
