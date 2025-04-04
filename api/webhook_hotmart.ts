import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gsvaxymcflhkossiixkf.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).send('Only POST allowed')
  }

  const data = req.body?.data
  const event = req.body?.event
  const email = data?.buyer?.email

  if (!email) return res.status(400).send('Email não fornecido')

  const hoje = new Date()
  const data_inicio = hoje.toISOString().split('T')[0]
  const data_expiracao = new Date(hoje)
  data_expiracao.setFullYear(data_expiracao.getFullYear() + 1)
  const data_expiracao_formatada = data_expiracao.toISOString().split('T')[0]

  try {
    if (event === 'PURCHASE_APPROVED') {
      const { error: insertError, data: insertData } = await supabase.from('users').insert([{
        email,
        status: 'ativo',
        plano: 'anual 57',
        data_inicio,
        data_expiracao: data_expiracao_formatada
      }])

      if (insertError) {
        console.error('❌ Erro ao inserir no Supabase:', insertError)
        return res.status(500).send('Erro ao salvar no Supabase')
      }

      console.log('✅ Inserido no Supabase:', insertData)

      // Enviando e-mail
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer re_MMVw4EJ1_MtuepBApAnQXaRvBYp66Pbie',
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

      const emailStatus = await emailRes.json()
      console.log('📨 Resultado do envio de e-mail:', emailStatus)

    } else if (event === 'SUBSCRIPTION_CANCELED' || event === 'PURCHASE_REFUNDED') {
      const { error: updateError } = await supabase.from('users').update({ status: 'inativo' }).eq('email', email)

      if (updateError) {
        console.error('❌ Erro ao atualizar status:', updateError)
        return res.status(500).send('Erro ao atualizar status')
      }

      console.log('🟡 Status atualizado para inativo:', email)
    }

    return res.status(200).send('OK')
  } catch (err: any) {
    console.error('❗ Erro interno no webhook:', err)
    return res.status(500).send('Erro interno')
  }
}
