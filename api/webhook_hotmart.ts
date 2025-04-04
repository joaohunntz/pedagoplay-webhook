import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gsvaxymcflhkossiixkf.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // sua chave completa aqui
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).send('Only POST allowed')
  }

  const data = req.body?.data
  const event = req.body?.event

  try {
    const email = data?.buyer?.email
    if (!email) return res.status(400).send('Email não fornecido')

    // ⏱️ Formatação das datas para colunas tipo DATE
    const hoje = new Date()
    const data_inicio = hoje.toISOString().split('T')[0]
    const data_expiracao = new Date(hoje)
    data_expiracao.setFullYear(data_expiracao.getFullYear() + 1)
    const data_expiracao_formatada = data_expiracao.toISOString().split('T')[0]

    if (event === 'PURCHASE_APPROVED') {
      console.log('🟢 Compra aprovada para:', email)

      const { error, data: supaResponse } = await supabase.from('users').upsert({
        email,
        status: 'ativo',
        plano: 'anual 57',
        data_inicio,
        data_expiracao: data_expiracao_formatada
      }, {
        onConflict: 'email'
      })

      if (error) {
        console.error('❌ Erro ao salvar no Supabase:', error)
        return res.status(500).send('Erro ao salvar no Supabase')
      }

      console.log('✅ Salvo no Supabase com sucesso:', supaResponse)

      // 📧 Envio de e-mail
      console.log('✉️ Enviando e-mail para:', email)

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer re_MMVw4EJ1_MtuepBApAnQXaRvBYp66Pbie', // token correto aqui
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'noreply@oabcards.com',
          to: email,
          subject: 'Bem-vindo ao OAB Cards! 🎉',
          html: `
            <h1>Seu acesso está liberado!</h1>
            <p>Olá, tudo certo! Você agora tem acesso ao OAB Cards por 1 ano.</p>
            <p>Use o e-mail <strong>${email}</strong> para entrar no aplicativo.</p>
            <p><a href="https://oabcards.com">Acessar agora</a></p>
          `
        })
      })

      const result = await response.json()
      console.log('📬 Resposta do Resend:', response.status, result)

    } else if (event === 'SUBSCRIPTION_CANCELED' || event === 'PURCHASE_REFUNDED') {
      console.log('🔴 Cancelamento ou reembolso detectado para:', email)

      const { error: updateError } = await supabase.from('users').update({
        status: 'inativo'
      }).eq('email', email)

      if (updateError) {
        console.error('❌ Erro ao atualizar status:', updateError)
        return res.status(500).send('Erro ao atualizar status')
      }

      console.log('🟡 Status atualizado para inativo')
    }

    return res.status(200).send('OK')

  } catch (err: any) {
    console.error('🔥 Erro interno no webhook:', err)
    return res.status(500).send('Erro interno')
  }
}
