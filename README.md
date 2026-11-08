# EVE Industry

An EVE Online dashboard with server status, PLEX prices, multi-character assets,
and a ship fitting workbench. Industry and planetary industry tracking are planned.


## API routes
| Route | Purpose |
| --- | --- |
| `GET /api/status` | Existing backend health check |
| `GET /api/auth/login` | Start EVE login or link another alt |
| `GET /api/auth/callback` | Validate login and save credentials on the server |
| `POST /api/auth/logout` | Invalidate the current session |
| `GET /api/characters` | Return linked character IDs and names only |
| `DELETE /api/characters?id=123` | Unlink a character from the current session |
| `GET /api/assets` | Combined assets for all linked characters |
| `GET /api/assets?character=123` | Assets for one linked character |


Authentication follows [EVE's SSO documentation](https://developers.eveonline.com/docs/services/sso/).
Asset loading follows [ESI pagination](https://developers.eveonline.com/docs/services/esi/pagination/x-pages/)
and [cache guidance](https://developers.eveonline.com/docs/services/esi/best-practices/).
Database access uses the [Upstash Redis REST API](https://upstash.com/docs/redis/features/restapi).
