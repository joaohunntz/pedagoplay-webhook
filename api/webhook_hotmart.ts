import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gsvaxymcflhkossiixkf.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzdmF4eW1jZmxoa29zc2lpeGtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Mzc3ODM4MCwiZXhwIjoyMDU5MzU0MzgwfQ.eo1xd_TcFTXyqh_XaU02kumFsEv82UcPgrUS70Vn2Rg'
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

    // cria datas em formato "yyyy-mm-dd" para colunas do tipo date
    const hoje = new Date()
    const data_inicio = hoje.toISOString().split('T')[0] // "2025-04-04"
    const data_expiracao = new Date(hoje)
    data_expiracao.setFullYear(data_expiracao.getFullYear() + 1)
    const data_expiracao_formatada = data_expiracao.toISOString().split('T')[0]

    if (event === 'PURCHASE_APPROVED') {
      await supabase.from('users').upsert({
        email,
        status: 'ativo',
        plano: 'anual 57',
        data_inicio,
        data_expiracao: data_expiracao_formatada
      }, { onConflict: 'email' })

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer re_MMVw4EJ1_MtuepBApAnQXaRvBYp66Pbie',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'noreply@oabcards.com',
          to: email,
          subject: 'Bem-vindo ao OAB Cards! 🎉',
          html: 
            <h1>Seu acesso está liberado!</h1>
            <p>Olá, tudo certo! Você agora tem acesso ao OAB Cards por 1 ano.</p>
            <p>Use o e-mail <strong>${email}</strong> para entrar no aplicativo.</p>
            <p><a href="https://oabcards.com">Acessar agora</a></p>
          
        })
      })

    } else if (event === 'SUBSCRIPTION_CANCELED' || event === 'PURCHASE_REFUNDED') {
      await supabase.from('users').update({ status: 'inativo' }).eq('email', email)
    }

    return res.status(200).send('OK')
  } catch (err: any) {
    console.error('Erro interno no webhook:', err)
    return res.status(500).send('Erro interno')
  }
}
