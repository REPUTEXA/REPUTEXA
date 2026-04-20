export const apiPageEs = {
  title: 'API REPUTEXA',
  subtitle:
    'Integra REPUTEXA para disparar invitaciones de reseña tras cada visita.',
  noticeTitle: 'Qué hace realmente la API',
  noticeBody:
    'La API de REPUTEXA es un <strong>webhook entrante</strong>: recibe datos de visita desde tu POS, Zapier o reservas y activa <strong>AI Capture</strong> — un WhatsApp 30 minutos después invitando a dejar reseña en Google.<br/><br/>Aún no hay API pública de <em>lectura</em> (GET /reviews, etc.). Los datos están en el <link>panel REPUTEXA</link>.',
  useCasesTitle: 'Casos de uso',
  useCases: [
    {
      iconKey: 'ShoppingCart',
      title: 'TPV / POS',
      description:
        'Square, SumUp, Lightspeed… Tras cada venta, envía el payload y AI Capture programa WhatsApp 30 min después.',
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
    {
      iconKey: 'Zap',
      title: 'Zapier / Make',
      description:
        'Shopify, WooCommerce, Airtable, formularios. Cada visita confirmada llama tu endpoint.',
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
    {
      iconKey: 'Smartphone',
      title: 'Reservas',
      description: 'TheFork, Resy, booking propio. Invitación 30 min tras la hora reservada, sin trabajo manual.',
      badge: 'ZENITH',
      badgeColor: 'bg-violet-500/20 text-violet-400',
    },
  ],
  keySectionTitle: 'Obtén tu clave',
  keyIntro:
    'La clave (<rtx>rtx_live_…</rtx>) se crea con ZENITH. Cópiala o rótala en el panel.',
  keySteps: [
    { step: '1', label: 'Panel → Ajustes' },
    { step: '2', label: 'Integraciones' },
    { step: '3', label: 'Copiar rtx_live_…' },
  ],
  keyFootnote: 'Hace falta ZENITH. DOMINATOR hereda acceso.',
  endpointTitle: 'Referencia del endpoint',
  endpointDoc: `POST https://reputexa.fr/api/webhooks/{tu_clave_rtx_live}

Content-Type: application/json

{
  "customerName": "María García",
  "phone": "+34600111222",
  "visitDate": "2026-03-22T14:30:00Z",
  "establishmentId": "tu_id"
}

// 200
{ "queued": true, "scheduledAt": "...", "message": "AI Capture programado." }

// 401
{ "error": "Clave API inválida o revocada" }

// 422
{ "error": "Teléfono inválido — E.164" }`,
  securityTitle: 'Seguridad y límites',
  securityRules: [
    { iconKey: 'Lock', text: 'rtx_live_ es por cuenta — no en frontend público.' },
    { iconKey: 'Shield', text: 'Validación de clave, E.164 y mínimo 120 días entre campañas al mismo número.' },
    { iconKey: 'AlertTriangle', text: 'Ventana de envío 09:00–21:00 hora París.' },
    { iconKey: 'CheckCircle', text: 'Mismo número: máx. un contacto cada 5 minutos.' },
  ],
  errorCodesTitle: 'Códigos',
  errorCodes: [
    { code: '200', desc: 'Recibido — encolado' },
    { code: '401', desc: 'Clave rtx_live_ ausente o inválida' },
    { code: '403', desc: 'AI Capture no incluido (ZENITH)' },
    { code: '409', desc: 'Deduplicación 5 min' },
    { code: '422', desc: 'Datos inválidos' },
    { code: '429', desc: 'Demasiadas peticiones' },
  ],
  zapierTitle: 'Ejemplo Zapier',
  zapierExample: `Trigger: Pedido pagado
Action: Webhook POST https://reputexa.fr/api/webhooks/rtx_live_XXX
Body JSON con customerName, phone, visitDate, establishmentId
→ WhatsApp 30 min después.`,
  ctaTitle: 'Activar POS / Zapier',
  ctaSubtitle: 'AI Capture solo en ZENITH. Prueba 14 días.',
  ctaPrimary: 'Prueba ZENITH',
  ctaSecondary: 'Guía de inicio',
};
