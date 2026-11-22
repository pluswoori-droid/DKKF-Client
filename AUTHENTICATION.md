# Microsoft authentication configuration

The publisher's Microsoft client identifier is intentionally omitted. Before building, configure your own approved public-client application in `shared/microsoft-app.json` and `android/app_pojavlauncher/src/main/assets/dkkf/microsoft-app.json` (`clientId`). No client secret belongs in either app. Do not commit login tokens, account files or signing keys.
