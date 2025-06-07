import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yglvnamoudgwbaigeypu.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbHZuYW1vdWRnd2JhaWdleXB1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDI0NTY2MCwiZXhwIjoyMDU5ODIxNjYwfQ.IC8i7I79zYYNwU8U56w2Y_4BardcMDa1P4N-gn_LKLY'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export default async function handler(req: any, res: any) {
  console.log('[HOTMART] Recebido webhook')

  if (req.method !== 'POST') {
    console.log('[HOTMART] Método não permitido')
    return res.status(405).send('Only POST allowed')
  }

  const { data, event } = req.body
  console.log('[HOTMART] Evento:', event)

  try {
    const email = data?.buyer?.email
    console.log('[HOTMART] Email:', email)

    if (!email) return res.status(400).send('Email não fornecido')

    const hoje = new Date()
    const data_inicio = hoje.toISOString().split('T')[0]
    const data_expiracao = new Date(hoje)
    data_expiracao.setFullYear(data_expiracao.getFullYear() + 1)
    const data_expiracao_formatada = data_expiracao.toISOString().split('T')[0]

    // 🔔 Evento de aprovação da compra
    if (event === 'PURCHASE_APPROVED') {
      console.log('[SUPABASE] Enviando dados para upsert...')
      const { error, data: responseData } = await supabase.from('users').upsert({
        email,
        status: 'ativo',
        plano: 'anual 57',
        data_inicio,
        data_expiracao: data_expiracao_formatada
      }, { onConflict: 'email' })

      if (error) {
        console.error('[SUPABASE] Erro:', error)
        return res.status(500).send('Erro ao salvar no Supabase')
      }

      console.log('[SUPABASE] Dados inseridos com sucesso:', responseData)

      // 🔑 Buscar chave disponível em psiq_keys
      const { data: chaveDisponivel, error: erroChave } = await supabase
        .from('psiq_keys')
        .select('key')
        .eq('used', false)
        .limit(1)
        .single()

      if (erroChave || !chaveDisponivel) {
        console.error('[SUPABASE] Erro ao buscar chave:', erroChave)
        return res.status(500).send('Erro ao gerar chave de acesso')
      }

      const chaveDeAcesso = chaveDisponivel.key

      // ✅ Marcar chave como usada
      await supabase
        .from('psiq_keys')
        .update({
          used: true,
          used_by_email: email,
          used_at: new Date()
        })
        .eq('key', chaveDeAcesso)

      console.log('[RESEND] Enviando e-mail...')
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer re_MMVw4EJ1_MtuepBApAnQXaRvBYp66Pbie',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'noreply@pedagoplay.click',
          to: email,
          subject: 'Welcome to PedagoPlay! 🎉',
          html: `
            <h1>Seu acesso está liberado!</h1>
            <p>Olá, sua chave de acesso ao PsiQ está pronta.</p>
            <p><strong>Sua chave de ativação:</strong></p>
            <pre style="font-size: 20px; background: #f5f5f5; padding: 10px; border-radius: 5px;">
${chaveDeAcesso}
            </pre>
            <p>Utilize seu e-mail Google para fazer login no aplicativo e insira a chave acima para liberar as funções premium.</p>
            <p>Qualquer dúvida, envie um e-mail para pedagotecabrasil@gmail.com </p>
            <p><a href="https://pedagoteca-pwa.vercel.app/">Acessar agora</a></p>
          `
        })
      })

      const emailJson = await emailRes.json()
      console.log('[RESEND] Resposta do envio:', emailJson)

    // ❌ Evento de cancelamento ou reembolso
    } else if (event === 'SUBSCRIPTION_CANCELED' || event === 'PURCHASE_REFUNDED') {
      console.log('[SUPABASE] Marcando usuário como inativo...')
      const { error: updateError } = await supabase.from('users').update({
        status: 'inativo'
      }).eq('email', email)

      if (updateError) {
        console.error('[SUPABASE] Erro ao atualizar status:', updateError)
        return res.status(500).send('Erro ao atualizar status')
      }

      console.log('[SUPABASE] Usuário marcado como inativo.')
    }

    console.log('[HOTMART] Tudo certo! Respondendo 200...')
    return res.status(200).send('OK')
  } catch (err: any) {
    console.error('[ERRO GERAL] Erro interno:', err)
    return res.status(500).send('Erro interno')
  }
}
