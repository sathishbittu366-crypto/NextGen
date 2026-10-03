# Result Delete Fix 0.0.2

Replace these files in the existing `nextgen_work` project, preserving their paths:

- `api/app.py`
- `api/routes_learning.py`
- `api/routes_result_delete.py` (new)
- `run_api.py`
- `tests/test_results_delete_route.py`

Then from the project root run:

```powershell
python -m pytest -q tests/test_results_delete_route.py
python run_api.py
```

The backend startup should print:

```text
[*] Admin result deletion route: DELETE /api/results/admin/{batch_id}
```

The route is admin-only and requires the `X-Result-Delete-Key` header. Set `RESULT_DELETE_KEY` in the environment for deployments.
