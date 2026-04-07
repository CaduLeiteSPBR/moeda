/**
 * Email sending via Resend API + HTML templates.
 */

const FROM = 'CoinHub <noreply@moedas.inovacx.com>'
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmailParams = {
  to: string
  subject: string
  html: string
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendEmail(params: EmailParams, apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error('[email] Resend error:', response.status, body)
      return false
    }

    return true
  } catch (err) {
    console.error('[email] sendEmail exception:', err)
    return false
  }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

function baseTemplate(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #18181b; }
    .wrapper { max-width: 600px; margin: 40px auto; padding: 0 16px 40px; }
    .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { color: #bfdbfe; font-size: 14px; margin-top: 4px; }
    .body { padding: 40px; }
    .body h2 { font-size: 20px; font-weight: 600; margin-bottom: 12px; color: #18181b; }
    .body p { font-size: 15px; line-height: 1.6; color: #52525b; margin-bottom: 16px; }
    .button { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; margin: 8px 0 24px; }
    .button:hover { background: #1d4ed8; }
    .divider { border: none; border-top: 1px solid #e4e4e7; margin: 24px 0; }
    .small { font-size: 13px; color: #a1a1aa; }
    .footer { text-align: center; padding: 24px 40px; }
    .footer p { font-size: 13px; color: #a1a1aa; }
    .highlight-box { background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 16px; margin: 16px 0; }
    .highlight-box p { color: #1e3a8a; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>🪙 CoinHub</h1>
        <p>Sua comunidade de colecionadores</p>
      </div>
      <div class="body">
        ${content}
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} CoinHub. Todos os direitos reservados.</p>
      <p style="margin-top:4px;">Este é um e-mail automático, não responda a esta mensagem.</p>
    </div>
  </div>
</body>
</html>`
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function verificationEmail(name: string, link: string): string {
  const content = `
    <h2>Bem-vindo ao CoinHub, ${escapeHtml(name)}! 👋</h2>
    <p>Ficamos felizes em tê-lo(a) conosco. Para começar a usar sua conta e explorar coleções de moedas e cédulas, confirme seu endereço de e-mail clicando no botão abaixo:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${link}" class="button">Verificar meu e-mail</a>
    </div>
    <hr class="divider" />
    <p class="small">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
    <p class="small" style="word-break: break-all; color: #3b82f6;">${link}</p>
    <hr class="divider" />
    <p class="small">Este link expira em <strong>24 horas</strong>. Se você não criou uma conta no CoinHub, ignore este e-mail.</p>
  `
  return baseTemplate('Verifique seu e-mail — CoinHub', content)
}

export function passwordResetEmail(name: string, link: string): string {
  const content = `
    <h2>Redefinição de senha</h2>
    <p>Olá, <strong>${escapeHtml(name)}</strong>!</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta CoinHub. Clique no botão abaixo para criar uma nova senha:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${link}" class="button">Redefinir minha senha</a>
    </div>
    <div class="highlight-box">
      <p>⚠️ Este link é válido por apenas <strong>1 hora</strong>. Após expirar, você precisará solicitar um novo link.</p>
    </div>
    <hr class="divider" />
    <p class="small">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
    <p class="small" style="word-break: break-all; color: #3b82f6;">${link}</p>
    <hr class="divider" />
    <p class="small">Se você não solicitou a redefinição de senha, ignore este e-mail. Sua senha permanece a mesma.</p>
  `
  return baseTemplate('Redefinição de senha — CoinHub', content)
}

export function interestEmail(
  ownerName: string,
  interestedName: string,
  interestedCity: string,
  itemDescription: string,
): string {
  const content = `
    <h2>Alguém demonstrou interesse na sua coleção! 🎉</h2>
    <p>Olá, <strong>${escapeHtml(ownerName)}</strong>!</p>
    <p>Boa notícia! Um colecionador demonstrou interesse em um item da sua coleção no CoinHub.</p>
    <div class="highlight-box">
      <p><strong>${escapeHtml(interestedName)}</strong>, de <strong>${escapeHtml(interestedCity)}</strong>, marcou interesse no item:</p>
      <p style="margin-top: 8px; font-style: italic;">${escapeHtml(itemDescription)}</p>
    </div>
    <p>Acesse sua caixa de mensagens no CoinHub para ver a mensagem e entrar em contato com o colecionador.</p>
    <hr class="divider" />
    <p class="small">Lembre-se: nunca compartilhe informações financeiras por mensagem. Todas as negociações são de responsabilidade dos usuários.</p>
  `
  return baseTemplate('Novo interesse na sua coleção — CoinHub', content)
}

export function newMessageEmail(
  receiverName: string,
  senderName: string,
  senderCity: string,
  preview: string,
): string {
  const content = `
    <h2>Você tem uma nova mensagem! 💬</h2>
    <p>Olá, <strong>${escapeHtml(receiverName)}</strong>!</p>
    <p><strong>${escapeHtml(senderName)}</strong>, de <strong>${escapeHtml(senderCity)}</strong>, enviou uma mensagem para você no CoinHub:</p>
    <div class="highlight-box">
      <p>"${escapeHtml(preview.length > 200 ? preview.slice(0, 200) + '…' : preview)}"</p>
    </div>
    <p>Acesse o CoinHub para responder.</p>
    <hr class="divider" />
    <p class="small">Se você não quiser mais receber notificações de mensagens, ajuste suas preferências no seu perfil.</p>
  `
  return baseTemplate('Nova mensagem — CoinHub', content)
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
