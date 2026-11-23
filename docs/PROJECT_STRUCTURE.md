# Project structure

- `backend/config/` contains database and mail setup.
- `backend/controllers/` is reserved for request handlers as the backend grows.
- `backend/middleware/` contains authentication and role checks.
- `backend/models/` contains MongoDB models.
- `backend/routes/` contains API routes.
- `backend/scripts/` contains developer utilities such as the email check.
- `frontend/public/` contains static assets copied by Vite.
- `frontend/src/pages/` contains route-level screens.
- `frontend/src/components/` contains reusable interface components.
- `frontend/src/services/` contains API, session, navigation, and formatting helpers.
- `frontend/src/context/` contains shared React state such as authentication.
- `docs/` contains project notes and the standalone Google sign-in diagnostic page.
