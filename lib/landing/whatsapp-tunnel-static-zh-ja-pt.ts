/**
 * Fallbacks tunnel WhatsApp (zh / ja / pt) sans clés IA - ton SMS natif, même logique métier que EN/FR.
 */

import type { TunnelDemoPayload, TunnelScenarioPath } from '@/types/whatsapp-tunnel-demo';

const E: TunnelDemoPayload['enginesUsed'] = [];

export const TUNNEL_STATIC_ZH_JA_PT: Record<
  'zh' | 'ja' | 'pt',
  Record<TunnelScenarioPath, TunnelDemoPayload>
> = {
  zh: {
    decline_first: {
      establishmentName: '梧桐小馆',
      enginesUsed: E,
      scenario: 'decline_first',
      messages: [
        {
          from: 'business',
          text: '您好，李女士，我是梧桐小馆的店长。我们想认真听听您对刚才那道黑椒牛柳饭和冻柠茶的真实感受，好把出品再磨细一点。\n\n若方便继续在这条对话里聊：请回复「是」表示愿意，或「否」表示不想收到后续消息 - 两种我们都尊重。若愿意，稍后能否占用您大约九十秒？',
        },
        { from: 'client', text: '不用了谢谢 我不想再收到这类信息' },
        {
          from: 'business',
          text: '好的，理解。这个号码会加入本次反馈的黑名单，我们不会再为这条流程联系您。期待下次光临。',
        },
      ],
    },
    happy_full: {
      establishmentName: '巷口咖啡',
      enginesUsed: E,
      scenario: 'happy_full',
      messages: [
        {
          from: 'business',
          text: '张先生，巷口咖啡这边 - 记得您上午带走了开心果可颂和冰澳白。我们想先把服务做好，不是来打扰。\n\n方便继续在这里聊两句反馈吗？请回复「是」或「否」。若「是」，今晚方便用两分钟说说哪里顺口、哪里不顺吗？',
        },
        { from: 'client', text: '行啊说吧' },
        {
          from: 'business',
          text: '谢谢。小提示：可颂想第二天复热，烤箱 160℃ 垫纸两分钟，酥皮会回来一点。实在话：奶咖浓度和开心果香您还觉得搭吗？吧台节奏有没有让您等太久？',
        },
        {
          from: 'client',
          text: '层次挺清楚 咖啡不涩 小哥手快 没尬聊',
        },
        {
          from: 'business',
          text: '如果您愿意在 Google 上留两行字，这里有一版很轻的草稿，完全自愿、零压力：\n\n「巷口咖啡：开心果可颂酥得干净，冰澳白顺口，吧台利落。」\n\n要改哪里吗？',
        },
        { from: 'client', text: '就这样挺好' },
        {
          from: 'business',
          text: '好的。要发布的文字在上一条消息里，长按即可复制。下一条消息只有演示链接。',
        },
        {
          from: 'business',
          text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
        },
        {
          from: 'business',
          text: '打开后粘贴、选星、发布。非常感谢。本条流程不再打扰；相关数据按约 120 天处理。',
        },
      ],
      googleScene: {
        reviewSnippet: '巷口咖啡：开心果可颂酥得干净，冰澳白顺口，吧台利落。',
        businessReply: '感谢详细反馈 - 我们会继续稳住出杯节奏和酥皮状态，欢迎再来坐一坐。',
        replyDelayHint: '次日上午约 10 点',
      },
    },
    happy_with_edit: {
      establishmentName: '城北理发',
      enginesUsed: E,
      scenario: 'happy_with_edit',
      messages: [
        {
          from: 'business',
          text: '王先生，城北理发的小周。刚才低渐变和鬓角修过，我们想听听真实感受。\n\n方便继续在这里聊一句吗？请回「是」或「否」。若「是」，一分钟就够。',
        },
        { from: 'client', text: '说吧' },
        { from: 'business', text: '后颈过渡和 foil 修完有没有刺痒？热毛巾气味会不会太冲？' },
        {
          from: 'client',
          text: '线条干净 就是毛巾香有点重',
        },
        {
          from: 'business',
          text: '如果想留一条网上评价，草稿可选：\n\n「城北理发：低渐变干净，后颈利落，团队细心。」\n\n要改吗？',
        },
        { from: 'client', text: '把细心去掉 太像广告' },
        {
          from: 'business',
          text: '好。「城北理发：低渐变干净，后颈利落。」这样可以吗？',
        },
        { from: 'client', text: '后颈利落也去掉 啰嗦' },
        {
          from: 'business',
          text: '「城北理发：低渐变干净。」还能再改，语音也行。',
        },
        { from: 'client', text: '行就这句' },
        {
          from: 'business',
          text: '收到。请复制上一条草稿（长按）。下一条只有演示链接。',
        },
        {
          from: 'business',
          text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
        },
        {
          from: 'business',
          text: '粘贴、选星、发布。感谢把文字磨细。本条流程不再发消息，数据约 120 天到期。',
        },
      ],
      googleScene: {
        reviewSnippet: '城北理发：低渐变干净。',
        businessReply: '感谢把细节说透 - 我们会让毛巾再淡一点，后颈线继续保持。',
        replyDelayHint: '约 6 小时后',
      },
    },
    stop_after_yes: {
      establishmentName: '静澜水疗',
      enginesUsed: E,
      scenario: 'stop_after_yes',
      messages: [
        {
          from: 'business',
          text: '陈女士，静澜水疗。刚才肩颈热石之后，我们想校准力度和节奏。\n\n方便再聊两句吗？请回「是」或「否」。若「是」，两分钟就够。',
        },
        { from: 'client', text: '好的' },
        {
          from: 'business',
          text: '谢谢。斜方肌那一段力度合适吗，还是偏重？',
        },
        { from: 'client', text: '算了我不想在 WhatsApp 上继续聊这个' },
        {
          from: 'business',
          text: '明白，打扰了。您已退出本次活动，我们不会再为这条流程联系您。仍感谢您今天到店。',
        },
      ],
    },
  },
  ja: {
    decline_first: {
      establishmentName: '路地裏ビストロ',
      enginesUsed: E,
      scenario: 'decline_first',
      messages: [
        {
          from: 'business',
          text: 'こんにちは、佐藤様。路地裏ビストロです。今日のランチの豚の角煮とご飯のフィードバックを伺い、厨房をもう一段磨きたいです。\n\nこのやり取りを続けてよい場合：「はい」か「いいえ」でお願いします。「いいえ」なら以降お送りしません。よろしければ後で90秒ほど。',
        },
        { from: 'client', text: '結構です もう連絡いらないです' },
        {
          from: 'business',
          text: '承知しました。本件の配信は停止し、この番号には再度お声がけしません。またのご来店をお待ちしています。',
        },
      ],
    },
    happy_full: {
      establishmentName: '珈琲 北浜',
      enginesUsed: E,
      scenario: 'happy_full',
      messages: [
        {
          from: 'business',
          text: '田中様、北浜です。朝のピスタチオクロワッサンとオーレをお持ち帰りでしたね。まずは改善のための正直な感想を伺いたく。\n\nここで続けてよい場合：「はい」か「いいえ」。「はい」なら今夜2分ほど、何が良かったか／気になったか教えてください。',
        },
        { from: 'client', text: 'いいよ' },
        {
          from: 'business',
          text: 'ありがとうございます。豆知識：翌日は160℃で2分ほど焼き直すとサク感が戻りやすいです。率直に、オーレの濃さとナッツの香りのバランス、いかがでしたか？',
        },
        {
          from: 'client',
          text: 'コーヒーしっかりしてて クロワッサンも甘さ控えめで好き',
        },
        {
          from: 'business',
          text: 'もしGoogleに一言残したい場合の下書きです（任意・ノープレッシャー）：\n\n「北浜：ピスタチオクロワッサンが軽く、オーレがしっかり。バーが早い。」\n\nこのままで大丈夫ですか？',
        },
        { from: 'client', text: 'それで' },
        {
          from: 'business',
          text: '了解です。投稿文は上のメッセージです。長押しでコピーしてください。次のメッセージはデモ用リンクだけです。',
        },
        {
          from: 'business',
          text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
        },
        {
          from: 'business',
          text: '開いたら貼り付け、星を選んで投稿。本スレではこれ以上お送りしません。データは約120日で消えます。',
        },
      ],
      googleScene: {
        reviewSnippet: '北浜：ピスタチオクロワッサンが軽く、オーレがしっかり。バーが早い。',
        businessReply: '丁寧なコメントありがとうございます。焙煎とクロワッサンのバランス、引き続き整えます。またお待ちしています。',
        replyDelayHint: '翌朝〜10時頃',
      },
    },
    happy_with_edit: {
      establishmentName: 'Fade 北側',
      enginesUsed: E,
      scenario: 'happy_with_edit',
      messages: [
        {
          from: 'business',
          text: '鈴木様、Fade北側のマヤです。先ほどのローフェード、仕上げのフィードバックを伺いたいです。\n\nここで続けてよい場合：「はい」か「いいえ」。',
        },
        { from: 'client', text: 'はい' },
        { from: 'business', text: '首筋のラインとフィニッシュ後の刺激はいかがでしたか？' },
        {
          from: 'client',
          text: 'ラインは綺麗 蒸しタオルの香りがちょっと強い',
        },
        {
          from: 'business',
          text: '任意の下書き：\n\n「Fade北側 - ローフェードが綺麗、首筋が締まる。」\n\n修正しますか？',
        },
        { from: 'client', text: '「綺麗」はやめて' },
        {
          from: 'business',
          text: '了解。「Fade北側 - ローフェードが整って首筋が締まる。」は？',
        },
        { from: 'client', text: '首筋が締まるもいらない' },
        {
          from: 'business',
          text: '「Fade北側 - ローフェードが整う。」ここまで詰められます。',
        },
        { from: 'client', text: 'それで' },
        {
          from: 'business',
          text: '承知しました。下書きは上のメッセージを長押しでコピー。次はデモリンクのみです。',
        },
        {
          from: 'business',
          text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
        },
        {
          from: 'business',
          text: '貼り付けて星を選んで投稿。ありがとうございました。',
        },
      ],
      googleScene: {
        reviewSnippet: 'Fade北側 - ローフェードが整う。',
        businessReply: '細かい調整のご指摘ありがとうございます。次回も丁寧に揃えます。',
        replyDelayHint: '約6時間後',
      },
    },
    stop_after_yes: {
      establishmentName: 'スパ 静波',
      enginesUsed: E,
      scenario: 'stop_after_yes',
      messages: [
        {
          from: 'business',
          text: '高橋様、静波です。ホットストーンのあと、圧とテンポを整えたく。\n\nこのやり取りを続けてよい場合：「はい」か「いいえ」。',
        },
        { from: 'client', text: 'はい' },
        {
          from: 'business',
          text: '肩甲骨周りの圧、強すぎましたか？',
        },
        { from: 'client', text: 'ストップで もうテキストはいいです' },
        {
          from: 'business',
          text: 'かしこまりました。ご迷惑をおかけしました。本件は配信停止です。またのご来店をお待ちしています。',
        },
      ],
    },
  },
  pt: {
    decline_first: {
      establishmentName: 'Tasca do Largo',
      enginesUsed: E,
      scenario: 'decline_first',
      messages: [
        {
          from: 'business',
          text: 'Olá Inês, aqui é a Tasca do Largo. Queremos ouvir com franqueza o que achou do caldo verde e do bacalhau ao almoço para afinar a cozinha.\n\nQuer continuar por aqui? Diga sim se aceita, ou não se preferir que não voltemos a escrever - respeitamos os dois. Se sim, mais tarde terá 90 segundos?',
        },
        { from: 'client', text: 'não obrigada não quero mais mensagens' },
        {
          from: 'business',
          text: 'Percebido, obrigada por responder. Ficamos sem contactar este número para esta recolha. Até breve.',
        },
      ],
    },
    happy_full: {
      establishmentName: 'Café Ribeira',
      enginesUsed: E,
      scenario: 'happy_full',
      messages: [
        {
          from: 'business',
          text: 'Olá Bruno, Café Ribeira - croissant de pistacho e galão por volta das 10. Queremos melhorar de verdade, não incomodar.\n\nSeguimos por aqui? Sim ou não. Se sim, consegue dois minutos honestos hoje à noite?',
        },
        { from: 'client', text: 'sim' },
        {
          from: 'business',
          text: 'Obrigado. Dica de balcão: se sobrar croissant, 2 min a 160º no forno com papel traz o crocante de volta. Na prática: o galão estava no ponto e o pistacho equilibrado?',
        },
        {
          from: 'client',
          text: 'sim camadas boas café encorpado rapidez no balcão',
        },
        {
          from: 'business',
          text: 'Se quiser deixar umas linhas no Google, rascunho leve (opcional):\n\n"Café Ribeira: croissant de pistacho fino, galão intenso, equipa ágil no balcão."\n\nQuer ajustes?',
        },
        { from: 'client', text: 'assim está' },
        {
          from: 'business',
          text: 'Perfeito. O texto a publicar está na mensagem acima: toque longo para copiar. A seguir só o link (demo).',
        },
        {
          from: 'business',
          text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
        },
        {
          from: 'business',
          text: 'Abre o Google: cola, escolhe estrelas, publica. Obrigado. Sem mais mensagens neste fluxo; dados até ~120 dias.',
        },
      ],
      googleScene: {
        reviewSnippet:
          'Café Ribeira: croissant de pistacho fino, galão intenso, equipa ágil no balcão.',
        businessReply:
          'Obrigado pelo detalhe - mantemos o ritmo no balcão e o crocante do croissant.',
        replyDelayHint: 'No dia seguinte (~10h)',
      },
    },
    happy_with_edit: {
      establishmentName: 'Barbearia Norte',
      enginesUsed: E,
      scenario: 'happy_with_edit',
      messages: [
        {
          from: 'business',
          text: 'Carlos - Leão na Norte. Degradê baixo + contorno há pouco; queremos afinar o acabamento.\n\nSeguimos por aqui? Sim ou não. Se sim, um minuto?',
        },
        { from: 'client', text: 'sim' },
        { from: 'business', text: 'Transição na nuca e irritação depois da navalha?' },
        {
          from: 'client',
          text: 'limpo mas a toalha a vapor cheirava muito a perfume',
        },
        {
          from: 'business',
          text: 'Rascunho opcional:\n\n"Norte - degradê limpo, nuca certinha, equipa atenta."\n\nMudanças?',
        },
        { from: 'client', text: 'tira atenta parece anúncio' },
        {
          from: 'business',
          text: 'Ok. "Norte - degradê limpo, nuca certinha." Melhor?',
        },
        { from: 'client', text: 'tira certinha' },
        {
          from: 'business',
          text: '"Norte - degradê limpo, nuca fina." Pode continuar a editar.',
        },
        { from: 'client', text: 'assim serve' },
        {
          from: 'business',
          text: 'Guardado. Copie o texto da mensagem anterior (toque longo). Segue só o link (demo).',
        },
        {
          from: 'business',
          text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
        },
        {
          from: 'business',
          text: 'Cola, estrelas, publicar. Obrigado. Fim de mensagens neste programa.',
        },
      ],
      googleScene: {
        reviewSnippet: 'Norte - degradê limpo, nuca fina.',
        businessReply: 'Obrigado pelo ajuste fino no texto - mantemos a nuca disciplinada.',
        replyDelayHint: '~6h depois',
      },
    },
    stop_after_yes: {
      establishmentName: 'Spa Olivo',
      enginesUsed: E,
      scenario: 'stop_after_yes',
      messages: [
        {
          from: 'business',
          text: 'Boa tarde Elena - Spa Olivo. Depois do ritual de pés e compressa quente, queremos calibrar pressão.\n\nSeguimos por aqui? Sim ou não? Se sim, dois minutos?',
        },
        { from: 'client', text: 'sim' },
        {
          from: 'business',
          text: 'A pressão nas panturrilhas estava certa ou demasiado forte?',
        },
        { from: 'client', text: 'para aqui prefiro não continuar no whatsapp' },
        {
          from: 'business',
          text: 'Claro, desculpe o incómodo. Fica fora desta campanha; não voltamos a escrever por este canal. Boa noite.',
        },
      ],
    },
  },
};
