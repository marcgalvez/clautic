# Configurar WhatsApp (Meta Cloud API)

1. **Meta Business Manager** verificat de l'empresa que opera la plataforma.
2. developers.facebook.com → Crea una app de tipus *Business* → afegeix el producte **WhatsApp**.
3. Afegeix i verifica el **número emissor** (no pot estar en ús a l'app de WhatsApp normal). Anota el *Phone number ID*.
4. Crea un **usuari del sistema** amb permís `whatsapp_business_messaging` i genera un token permanent → `WHATSAPP_ACCESS_TOKEN`.
5. **Webhook:** URL `https://EL-TEU-DOMINI/api/whatsapp/webhook`, token de verificació = `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; subscriu el camp `messages`. Copia el *App secret* a `WHATSAPP_APP_SECRET`.
6. Crea la plantilla i espera l'aprovació. Després posa `WHATSAPP_PROVIDER=meta_cloud`.

## Plantilla `recordatori_cita` — categoria UTILITY

Variables del cos: `{{1}}` nom · `{{2}}` centre · `{{3}}` data · `{{4}}` hora · `{{5}}` servei.
Botó de tipus URL dinàmica: `https://EL-TEU-DOMINI/cita/{{1}}` (text del botó: "Gestionar la cita").

**Català (ca)**
```
Hola, {{1}}! 👋

Et recordem que demà tens una cita a {{2}}.

📅 {{3}}
🕒 {{4}} h
✂️ {{5}}

T'esperem!

Si necessites modificar o cancel·lar la cita, pots fer-ho amb el botó.
```

**Castellano (es)**
```
¡Hola, {{1}}! 👋

Te recordamos que mañana tienes una cita en {{2}}.

📅 {{3}}
🕒 {{4}} h
✂️ {{5}}

¡Te esperamos!

Si necesitas modificar o cancelar la cita, puedes hacerlo con el botón.
```

Notes:
- La paraula "demà" assumeix el recordatori de 24 h. Si un centre configura un altre nombre d'hores, crea una segona plantilla sense "demà".
- No hi posis mai dades de salut ni el motiu de la visita: el nom del servei ha de ser genèric en centres sanitaris.
- Prova primer amb `WHATSAPP_PROVIDER=log` en desenvolupament: els missatges es registren però no s'envien (el panell ho indica clarament).
