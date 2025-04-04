import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const SUPABASE_URL = 'https://gsvaxymcflhkossiixkf.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzdmF4eW1jZmxoa29zc2lpeGtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Mzc3ODM4MCwiZXhwIjoyMDU5MzU0MzgwfQ.eo1xd_TcFTXyqh_XaU02kumFsEv82UcPgrUS70Vn2Rg'
const resend = new Resend('re_MMVw4EJ1_MtuepBApAnQXaRvBYp66Pbie')
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Only POST allowed')

  const data = req.body

  try {
    const productName = data?.product?.name
    const planName = data?.subscription_plan?.name || ''
    const email = data?.buyer?.email
    const status = data?.event

    // 🔧 Ajuste temporário para testes: não exige produto/plano
    if (!email) {
      return res.status(400).send('Email não fornecido')
    }

    const data_inicio = new Date()
    const data_expiracao = new Date()
    data_expiracao.setFullYear(data_inicio.getFullYear() + 1)

    if (status === 'PURCHASE_APPROVED') {
      await supabase.from('users').upsert({
        email,
        status: 'ativo',
        plano: 'anual 57',
        data_inicio,
        data_expiracao
      }, { onConflict: 'email' })

      await resend.emails.send({
        from: 'noreply@oabcards.com',
        to: email,
        subject: 'Bem-vindo ao OAB Cards! 🎉',
        html: `<h1>Seu acesso está liberado!</h1><p>Olá, tudo certo! Você agora tem acesso ao OAB Cards por 1 ano.</p><p>Use o e-mail <strong>${email}</strong> para entrar no aplicativo.</p><p><a href="https://oabcards.com">Acessar agora</a></p>`
      })

    } else if (status === 'SUBSCRIPTION_CANCELED' || status === 'PURCHASE_REFUNDED') {
      await supabase.from('users').update({ status: 'inativo' }).eq('email', email)
    }

    return res.status(200).send('OK')

  } catch (err) {
    console.error(err)
    return res.status(500).send('Erro interno')
  }
}
