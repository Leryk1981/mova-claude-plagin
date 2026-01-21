# Security

- Do not log secrets or tokens
- Use environment variables for credentials
- Avoid unsafe shell patterns (curl | sh, sudo, rm -rf)
- Validate external inputs before use
- Escape user input in HTML/SQL contexts
- Use HTTPS for external requests
- Never commit sensitive files (.env, .pem, credentials)
