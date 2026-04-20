import type { SiteLocaleCode } from '@/lib/i18n/site-locales-catalog';

/** Champs d’un témoignage remplacés pour une locale (les ids, plans, notes restent sur le bloc EN). */
export type TestimonialLocaleFields = {
  name: string;
  role: string;
  company: string;
  sector: string;
  location: string;
  quote: string;
  result: string;
};

export type TestimonialLocalePack = {
  partials: TestimonialLocaleFields[];
  globalMetrics: { value: string; label: string }[];
  allSectorsLabel: string;
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
};

const DE: TestimonialLocalePack = {
  partials: [
    {
      name: 'Anna Schneider',
      role: 'Geschäftsführerin',
      company: 'Azur Hotelgruppe',
      sector: 'Hotellerie',
      location: 'München, Deutschland',
      quote:
        'Vor REPUTEXA haben wir höchstens 20 % der Google-Bewertungen beantwortet. Heute erhalten 100 % innerhalb von 24 Stunden eine persönliche Antwort. Unsere Note stieg in vier Monaten von 3,8 auf 4,7 Sterne. Das Shield Center hat eine koordinierte Rufmordkampagne erkannt, die wir allein nie entdeckt hätten.',
      result: '+0,9 ★ in 4 Monaten · Antwortquote 20 % → 100 %',
    },
    {
      name: 'Jonas Weber',
      role: 'Inhaber',
      company: 'Gasthaus Zur Ecke',
      sector: 'Gastronomie',
      location: 'Hamburg, Deutschland',
      quote:
        'Als Gastronom hatte ich Sorge, KI-Antworten würden künstlich klingen. Es ist das Gegenteil — Gäste glauben, ich schreibe selbst. Der Ton passt zu unserem lockeren, freundlichen Stil. Wir sparen rund 8 Stunden pro Woche.',
      result: '8 Std./Woche gespart · Note 4,2 → 4,6 ★',
    },
    {
      name: 'Lena Hoffmann',
      role: 'Leitung Digitales Marketing',
      company: 'Klinik Prima Ästhetik',
      sector: 'Gesundheit & Wellness',
      location: 'Berlin, Deutschland',
      quote:
        'Im Gesundheitswesen sind Bewertungen heikel. REPUTEXA hält Antworten professionell und im Einklang mit medizinischer Ethik. Der Compliance-Filter der KI ist hervorragend.',
      result: 'Note 4,0 → 4,8 ★ · +23 % überwiesene Neupatienten',
    },
    {
      name: 'Michael Brenner',
      role: 'COO',
      company: 'FLASH Hair (12 Salons)',
      sector: 'Beauty',
      location: 'Metropolregion Rhein-Ruhr',
      quote:
        'Zwölf Salons und ihre Bewertungen zu managen war Chaos. REPUTEXA bündelt alles. Der monatliche Auto-Report gibt mir pro Standort Klarheit — unverzichtbar für eine Kette.',
      result: '12 Standorte · ~90 % weniger Zeit für Bewertungen',
    },
    {
      name: 'Sophie Krämer',
      role: 'Inhaberin',
      company: 'Die Käsestube',
      sector: 'Einzelhandel vor Ort',
      location: 'Köln, Deutschland',
      quote:
        'Ich bin ein kleines Handwerksgeschäft, kein Konzern. REPUTEXA ist für Betriebe wie meinen gemacht — einfach, bezahlbar, wirksam. Google stieg von 4,1 auf 4,9 ★, und die Laufkundschaft in der Region wuchs.',
      result: '4,1 → 4,9 ★ · Doppelte Sichtbarkeit in Maps',
    },
    {
      name: 'Tim Schneider',
      role: 'CEO',
      company: 'TechServ Solutions (100 B2B-Kunden)',
      sector: 'IT-Dienstleistungen',
      location: 'Frankfurt am Main, Deutschland',
      quote:
        'Wir haben REPUTEXA per API an unser CRM angebunden. In zwei Tagen löst jede neue Bewertung einen Entwurf in Salesforce aus. Saubere Doku, zuverlässige Webhooks.',
      result: 'API in 2 Tagen live · 100 Kunden automatisiert',
    },
    {
      name: 'Fatima Öztürk',
      role: 'Leitung',
      company: 'Seniorenresidenz Goldene Gärten',
      sector: 'Pflege & Gesundheit',
      location: 'Stuttgart, Deutschland',
      quote:
        'In der Pflege zählt das Vertrauen der Angehörigen. REPUTEXA zeigt, dass wir professionell antworten. Das Solidaritätsprogramm machte die Plattform für uns leistbar.',
      result: 'Vertrauensindex Angehörige +41 % · Belegung +8 %',
    },
    {
      name: 'Felix Lang',
      role: 'Gründer',
      company: 'Zen Yoga Studio',
      sector: 'Sport & Wellness',
      location: 'München, Deutschland',
      quote:
        'Beim Start hatten wir 15 Google-Bewertungen. Nach sechs Monaten: 87 Bewertungen, 4,9 ★. Der QR-Code für Bewertungen am Empfang ist ein Game Changer.',
      result: '15 → 87 Bewertungen in 6 Monaten · Platz 3 auf 1 lokal in Maps',
    },
    {
      name: 'Julia Brandt',
      role: 'Leitung Kommunikation',
      company: 'Apothekenkette Well+ (8 Filialen)',
      sector: 'Apotheken',
      location: 'Bayern',
      quote:
        'Das Shield Center meldete eine Welle falscher Negativbewertungen in zwei Filialen — wohl unlauterer Wettbewerb. REPUTEXA erstellte Google-Widerspruchspakete in wenigen Klicks; die meisten waren innerhalb von 72 Stunden weg.',
      result: '23 gefälschte Bewertungen entfernt · 8 Filialen geschützt',
    },
    {
      name: 'Peter Neumann',
      role: 'Geschäftsführer',
      company: 'Grant Immobiliengruppe (5 Büros)',
      sector: 'Immobilien',
      location: 'Hannover, Deutschland',
      quote:
        'Vertrauen ist im Immobiliengeschäft alles. Aktives Review-Management erhöhte die Google-Lead-Konversion um 31 % bei fünf synchron geführten Büros.',
      result: '+31 % Google-Lead-Konversion · 5 Büros im Gleichschritt',
    },
  ],
  globalMetrics: [
    { value: '3.200+', label: 'Aktive Standorte' },
    { value: '+0,7 ★', label: 'Ø-Bewertungsplus in 6 Monaten' },
    { value: '98 %', label: 'Zufrieden oder sehr zufrieden' },
    { value: '4,9 ★', label: 'REPUTEXA auf G2' },
  ],
  allSectorsLabel: 'Alle Branchen',
  ctaTitle: 'Schließen Sie sich über 3.200 Standorten an, die ihre Reputation ausbauen',
  ctaBody: '14 Tage kostenlos testen, keine Kreditkarte. Vertrauen aufbauen — ab heute.',
  ctaButton: 'Kostenlos starten',
};

const ES: TestimonialLocalePack = {
  partials: [
    {
      name: 'Laura Martínez',
      role: 'Directora general',
      company: 'Grupo hotelero Azur',
      sector: 'Hostelería',
      location: 'Barcelona, España',
      quote:
        'Antes de REPUTEXA respondíamos a un 20 % de las reseñas de Google. Ahora el 100 % recibe una respuesta personalizada en 24 horas. Nuestra nota pasó de 3,8 a 4,7 en cuatro meses. Shield Center detectó una campaña coordinada de desprestigio que solos no habríamos visto.',
      result: '+0,9 ★ en 4 meses · Tasa de respuesta 20 % → 100 %',
    },
    {
      name: 'Carlos Vega',
      role: 'Propietario',
      company: 'Brasería El Patio',
      sector: 'Restauración',
      location: 'Valencia, España',
      quote:
        'Como hostelero temía que las respuestas con IA sonaran falsas. Ocurre lo contrario: los clientes creen que las escribo yo. El tono encaja con nuestro estilo cercano. Ahorramos unas 8 horas por semana.',
      result: '8 h/semana ahorradas · Nota 4,2 → 4,6 ★',
    },
    {
      name: 'Elena Ruiz',
      role: 'Responsable de marketing digital',
      company: 'Clínica Prima Estética',
      sector: 'Salud y bienestar',
      location: 'Madrid, España',
      quote:
        'En salud las reseñas son delicadas. REPUTEXA mantiene respuestas profesionales y alineadas con la ética médica. El filtro de cumplimiento de la IA es excelente.',
      result: 'Nota 4,0 → 4,8 ★ · +23 % nuevos pacientes derivados',
    },
    {
      name: 'Miguel Sánchez',
      role: 'Director de operaciones',
      company: 'Red FLASH Peluquerías (12 salones)',
      sector: 'Belleza',
      location: 'Comunidad de Madrid',
      quote:
        'Gestionar doce salones y sus reseñas era un caos. REPUTEXA lo centraliza. El informe mensual automático me da visibilidad por salón — imprescindible para una cadena.',
      result: '12 locales · ~90 % menos tiempo en reseñas',
    },
    {
      name: 'Isabel Torres',
      role: 'Propietaria',
      company: 'La Quesería del Barrio',
      sector: 'Comercio local',
      location: 'Sevilla, España',
      quote:
        'Soy una tienda artesanal, no una multinacional. REPUTEXA está pensado para negocios como el mío: simple, asequible y efectivo. Google pasó de 4,1 a 4,9 ★ y aumentó el tráfico en el área metropolitana.',
      result: '4,1 → 4,9 ★ · Visibilidad duplicada en Maps',
    },
    {
      name: 'David Herrera',
      role: 'CEO',
      company: 'TechServ Solutions (100 cuentas B2B)',
      sector: 'Servicios TI',
      location: 'Bilbao, España',
      quote:
        'Conectamos REPUTEXA a nuestro CRM por API. En dos días cada nueva reseña genera un borrador en Salesforce. Documentación clara, webhooks fiables.',
      result: 'API en producción en 2 días · 100 cuentas automatizadas',
    },
    {
      name: 'Ana Gómez',
      role: 'Directora',
      company: 'Residencia Jardines Dorados',
      sector: 'Centros sanitarios',
      location: 'Zaragoza, España',
      quote:
        'En una residencia la confianza de las familias lo es todo. REPUTEXA demuestra que respondemos con profesionalidad. El programa de precios solidarios nos dio acceso a la plataforma.',
      result: 'Índice de confianza familiar +41 % · Ocupación +8 %',
    },
    {
      name: 'Javier López',
      role: 'Fundador',
      company: 'Zen Yoga Studio',
      sector: 'Deporte y bienestar',
      location: 'Málaga, España',
      quote:
        'Empezamos con 15 reseñas en Google. A los seis meses: 87 reseñas y 4,9 ★. El QR para reseñas en recepción marca la diferencia.',
      result: '15 → 87 reseñas en 6 meses · Del 3.º al 1.º en Maps local',
    },
    {
      name: 'Carmen Ibáñez',
      role: 'Responsable de comunicación',
      company: 'Cadena de farmacias Well+ (8 tiendas)',
      sector: 'Farmacia',
      location: 'Andalucía',
      quote:
        'Shield Center alertó de una oleada de negativas falsas en dos tiendas — posible competencia desleal. REPUTEXA generó los paquetes de disputa para Google en pocos clics; la mayoría cayeron en 72 horas.',
      result: '23 reseñas falsas retiradas · 8 tiendas protegidas',
    },
    {
      name: 'Roberto Gil',
      role: 'Director general',
      company: 'Grant Inmobiliaria (5 oficinas)',
      sector: 'Inmobiliaria',
      location: 'Alicante, España',
      quote:
        'En el sector inmobiliario la confianza lo es todo. Gestionar activamente las reseñas elevó la conversión de leads de Google un 31 % con cinco oficinas alineadas.',
      result: '+31 % conversión de leads Google · 5 oficinas coordinadas',
    },
  ],
  globalMetrics: [
    { value: '3.200+', label: 'Locales activos' },
    { value: '+0,7 ★', label: 'Subida media de nota en 6 meses' },
    { value: '98 %', label: 'Clientes satisfechos o muy satisfechos' },
    { value: '4,9 ★', label: 'REPUTEXA en G2' },
  ],
  allSectorsLabel: 'Todos los sectores',
  ctaTitle: 'Únase a más de 3.200 negocios que fortalecen su reputación',
  ctaBody: 'Prueba gratuita de 14 días, sin tarjeta. Empiece a generar confianza hoy.',
  ctaButton: 'Empezar gratis',
};

const IT: TestimonialLocalePack = {
  partials: [
    {
      name: 'Giulia Romano',
      role: 'Amministratrice delegata',
      company: 'Gruppo alberghiero Azur',
      sector: 'Ospitalità',
      location: 'Milano, Italia',
      quote:
        'Prima di REPUTEXA rispondevamo a circa il 20% delle recensioni Google. Oggi il 100% riceve una risposta personalizzata entro 24 ore. Il voto è passato da 3,8 a 4,7 in quattro mesi. Shield Center ha individuato una campagna coordinata che da soli non avremmo visto.',
      result: '+0,9 ★ in 4 mesi · Tasso di risposta 20% → 100%',
    },
    {
      name: 'Marco Bianchi',
      role: 'Titolare',
      company: 'Braceria Il Cortile',
      sector: 'Ristorazione',
      location: 'Bologna, Italia',
      quote:
        'Come ristoratore temevo che le risposte IA suonassero finte. È il contrario: i clienti pensano che scriva io. Il tono è quello cordiale del locale. Risparmiamo circa 8 ore a settimana.',
      result: '8 h/sett. risparmiate · Voto 4,2 → 4,6 ★',
    },
    {
      name: 'Sara Conti',
      role: 'Responsabile marketing digitale',
      company: 'Clinica Prima Estetica',
      sector: 'Salute e benessere',
      location: 'Roma, Italia',
      quote:
        'Nel settore sanitario le recensioni sono delicate. REPUTEXA mantiene risposte professionali e conformi all’etica medica. Il filtro compliance dell’IA è eccellente.',
      result: 'Voto 4,0 → 4,8 ★ · +23% nuovi pazienti segnalati',
    },
    {
      name: 'Andrea Ferretti',
      role: 'Direttore operativo',
      company: 'Rete FLASH Hair (12 saloni)',
      sector: 'Beauty',
      location: 'Lombardia',
      quote:
        'Gestire dodici saloni e le recensioni era il caos. REPUTEXA centralizza tutto. Il report mensile automatico dà chiarezza su ogni sede — essenziale per una catena.',
      result: '12 sedi · ~90% meno tempo sulle recensioni',
    },
    {
      name: 'Elena Ricci',
      role: 'Titolare',
      company: 'La Bottega del Formaggio',
      sector: 'Vicinato / retail',
      location: 'Torino, Italia',
      quote:
        'Sono una piccola bottega artigiana. REPUTEXA è pensato per realtà come la mia: semplice, conveniente, efficace. Google da 4,1 a 4,9 ★ e più passaggi in zona.',
      result: '4,1 → 4,9 ★ · Visibilità raddoppiata su Maps',
    },
    {
      name: 'Luca Marini',
      role: 'CEO',
      company: 'TechServ Solutions (100 account B2B)',
      sector: 'Servizi IT',
      location: 'Firenze, Italia',
      quote:
        'Abbiamo collegato REPUTEXA al CRM via API. In due giorni ogni nuova recensione genera una bozza in Salesforce. Documentazione chiara, webhook affidabili.',
      result: 'API attiva in 2 giorni · 100 account automatizzati',
    },
    {
      name: 'Chiara Esposito',
      role: 'Direttrice',
      company: 'RSA Giardini d’Oro',
      sector: 'Strutture sanitarie',
      location: 'Napoli, Italia',
      quote:
        'In una RSA la fiducia delle famiglie conta. REPUTEXA mostra che rispondiamo in modo professionale. Il programma solidarietà ha reso accessibile la piattaforma.',
      result: 'Indice fiducia famiglie +41% · Occupazione +8%',
    },
    {
      name: 'Matteo Galli',
      role: 'Fondatore',
      company: 'Zen Yoga Studio',
      sector: 'Sport e benessere',
      location: 'Padova, Italia',
      quote:
        'All’inizio avevamo 15 recensioni Google. Dopo sei mesi: 87 recensioni, 4,9 ★. Il QR in reception per raccogliere recensioni fa la differenza.',
      result: '15 → 87 recensioni in 6 mesi · Da 3° a 1° su Maps locale',
    },
    {
      name: 'Francesca Leone',
      role: 'Responsabile comunicazione',
      company: 'Catena farmacie Well+ (8 punti vendita)',
      sector: 'Farmacia',
      location: 'Veneto',
      quote:
        'Shield Center ha segnalato un’ondata di negative false su due punti vendita — probabile concorrenza sleale. REPUTEXA ha preparato i pacchetti contestazione Google in pochi clic; la maggior parte rimosse entro 72 ore.',
      result: '23 recensioni false rimosse · 8 negozi protetti',
    },
    {
      name: 'Paolo Costa',
      role: 'Amministratore delegato',
      company: 'Grant Immobiliare (5 sedi)',
      sector: 'Immobiliare',
      location: 'Palermo, Italia',
      quote:
        'Nel settore immobiliare la fiducia è tutto. Gestire attivamente le recensioni ha aumentato la conversione lead Google del 31% con cinque agenzie allineate.',
      result: '+31% conversione lead Google · 5 agenzie allineate',
    },
  ],
  globalMetrics: [
    { value: '3.200+', label: 'Sedi attive' },
    { value: '+0,7 ★', label: 'Incremento medio voto in 6 mesi' },
    { value: '98%', label: 'Clienti soddisfatti o molto soddisfatti' },
    { value: '4,9 ★', label: 'REPUTEXA su G2' },
  ],
  allSectorsLabel: 'Tutti i settori',
  ctaTitle: 'Unisciti a oltre 3.200 attività che rafforzano la reputazione',
  ctaBody: 'Prova gratuita 14 giorni, senza carta. Inizia a costruire fiducia oggi.',
  ctaButton: 'Inizia gratis',
};

const PT: TestimonialLocalePack = {
  partials: [
    {
      name: 'Ana Rodrigues',
      role: 'CEO',
      company: 'Grupo hoteleiro Azur',
      sector: 'Hotelaria',
      location: 'Lisboa, Portugal',
      quote:
        'Antes da REPUTEXA respondíamos a cerca de 20% das avaliações no Google. Agora 100% recebem uma resposta personalizada em 24 horas. A nota subiu de 3,8 para 4,7 em quatro meses. O Shield Center detetou uma campanha coordenada que sozinhos não teríamos visto.',
      result: '+0,9 ★ em 4 meses · Taxa de resposta 20% → 100%',
    },
    {
      name: 'João Silva',
      role: 'Proprietário',
      company: 'Brasserie O Pátio',
      sector: 'Restauração',
      location: 'Porto, Portugal',
      quote:
        'Como restaurador temia que respostas de IA soassem falsas. É o oposto: os clientes acham que escrevi eu. O tom combina com o nosso estilo descontraído. Poupança de cerca de 8 horas por semana.',
      result: '8 h/semana poupadas · Nota 4,2 → 4,6 ★',
    },
    {
      name: 'Mariana Costa',
      role: 'Responsável de marketing digital',
      company: 'Clínica Prima Estética',
      sector: 'Saúde e bem-estar',
      location: 'Braga, Portugal',
      quote:
        'Na área da saúde as avaliações são sensíveis. A REPUTEXA mantém respostas profissionais alinhadas com a ética médica. O filtro de compliance da IA é excelente.',
      result: 'Nota 4,0 → 4,8 ★ · +23% novos pacientes referenciados',
    },
    {
      name: 'Ricardo Almeida',
      role: 'Diretor de operações',
      company: 'Rede FLASH Cabeleireiros (12 salões)',
      sector: 'Beleza',
      location: 'Grande Lisboa',
      quote:
        'Gerir doze salões e avaliações era caos. A REPUTEXA centraliza tudo. O relatório mensal automático dá-me visão por local — essencial para uma rede.',
      result: '12 locais · ~90% menos tempo em avaliações',
    },
    {
      name: 'Beatriz Ferreira',
      role: 'Proprietária',
      company: 'A Queijaria da Praça',
      sector: 'Comércio de proximidade',
      location: 'Coimbra, Portugal',
      quote:
        'Sou uma pequena loja artesanal. A REPUTEXA é feita para negócios como o meu: simples, acessível, eficaz. O Google passou de 4,1 para 4,9 ★ e o movimento na área metropolitana aumentou.',
      result: '4,1 → 4,9 ★ · Visibilidade duplicada no Maps',
    },
    {
      name: 'Tiago Martins',
      role: 'CEO',
      company: 'TechServ Solutions (100 contas B2B)',
      sector: 'Serviços de TI',
      location: 'Aveiro, Portugal',
      quote:
        'Ligámos a REPUTEXA ao CRM por API. Em dois dias cada nova avaliação gera um rascunho no Salesforce. Documentação limpa, webhooks fiáveis.',
      result: 'API em produção em 2 dias · 100 contas automatizadas',
    },
    {
      name: 'Inês Carvalho',
      role: 'Diretora',
      company: 'Residência Jardins de Ouro',
      sector: 'Unidades de saúde',
      location: 'Faro, Portugal',
      quote:
        'Numa residência a confiança das famílias é fundamental. A REPUTEXA mostra que respondemos com profissionalismo. O programa de preços solidários tornou a plataforma acessível.',
      result: 'Índice de confiança das famílias +41% · Ocupação +8%',
    },
    {
      name: 'Gonçalo Pinto',
      role: 'Fundador',
      company: 'Zen Yoga Studio',
      sector: 'Desporto e bem-estar',
      location: 'Funchal, Portugal',
      quote:
        'Começámos com 15 avaliações no Google. Seis meses depois: 87 avaliações, 4,9 ★. O QR na receção para pedir avaliações faz toda a diferença.',
      result: '15 → 87 avaliações em 6 meses · Do 3.º ao 1.º no Maps local',
    },
    {
      name: 'Sofia Ribeiro',
      role: 'Responsável de comunicação',
      company: 'Cadeia de farmácias Well+ (8 lojas)',
      sector: 'Farmácia',
      location: 'Norte de Portugal',
      quote:
        'O Shield Center alertou para uma vaga de negativas falsas em duas lojas — possível concorrência desleal. A REPUTEXA gerou os pacotes de contestação no Google em poucos cliques; a maioria caiu em 72 horas.',
      result: '23 avaliações falsas removidas · 8 lojas protegidas',
    },
    {
      name: 'Miguel Sousa',
      role: 'Diretor-geral',
      company: 'Grant Imobiliária (5 escritórios)',
      sector: 'Imobiliário',
      location: 'Évora, Portugal',
      quote:
        'No imobiliário a confiança é tudo. Gerir avaliações de forma ativa aumentou a conversão de leads Google em 31% com cinco agências alinhadas.',
      result: '+31% conversão de leads Google · 5 agências em sintonia',
    },
  ],
  globalMetrics: [
    { value: '3.200+', label: 'Estabelecimentos ativos' },
    { value: '+0,7 ★', label: 'Subida média da nota em 6 meses' },
    { value: '98%', label: 'Clientes satisfeitos ou muito satisfeitos' },
    { value: '4,9 ★', label: 'REPUTEXA no G2' },
  ],
  allSectorsLabel: 'Todos os setores',
  ctaTitle: 'Junte-se a mais de 3.200 negócios a fortalecer a reputação',
  ctaBody: 'Teste gratuito de 14 dias, sem cartão. Comece a gerar confiança hoje.',
  ctaButton: 'Começar grátis',
};

const JA: TestimonialLocalePack = {
  partials: [
    {
      name: '佐藤 美咲',
      role: '代表取締役',
      company: 'アジュール・ホスピタリティグループ',
      sector: '宿泊',
      location: '東京都',
      quote:
        'REPUTEXA導入前はGoogleの口コミの2割ほどしか返信できていませんでした。今は100%が24時間以内に個別の返信を受け取ります。4か月で評価は3.8から4.7に。Shield Centerが、自力では見逃していた組織的な風評被害を検知しました。',
      result: '4か月で+0.9★ · 返信率 20%→100%',
    },
    {
      name: '田中 健',
      role: 'オーナー',
      company: 'コートヤード・ブラッスリー',
      sector: '飲食',
      location: '大阪府',
      quote:
        '飲食店としてAI返信は不自然ではと心配していましたが逆です。お客様は私が書いたと思っています。カジュアルで親しみやすいトーンに合い、週約8時間の削減になりました。',
      result: '週8時間削減 · 評価 4.2→4.6★',
    },
    {
      name: '山本 さくら',
      role: 'デジタルマーケ責任者',
      company: 'プリマ美容クリニック',
      sector: 'ヘルス＆ウェルネス',
      location: '福岡県',
      quote:
        '医療領域では口コミがデリケートです。REPUTEXAは医療倫理に沿ったプロの返信を保ち、コンプライアンスを意識したAIフィルタが優れています。',
      result: '評価 4.0→4.8★ · 紹介新患+23%',
    },
    {
      name: '鈴木 大輔',
      role: 'COO',
      company: 'FLASHヘア チェーン（12店舗）',
      sector: 'ビューティ',
      location: '関東',
      quote:
        '12店舗の口コミ管理はカオスでした。REPUTEXAで一元化。月次の自動レポートで各店の状況が把握でき、チェーンには欠かせません。',
      result: '12店舗 · 口コミ対応時間 約90%削減',
    },
    {
      name: '高橋 由美',
      role: 'オーナー',
      company: 'ビレッジチーズショップ',
      sector: '地域小売',
      location: '北海道',
      quote:
        '小さな専門店ですが、REPUTEXAはシンプルで手頼りで効きます。Googleは4.1から4.9★に。周辺エリアからの来店も増えました。',
      result: '4.1→4.9★ · Mapsでの露出が約2倍',
    },
    {
      name: '伊藤 翔',
      role: 'CEO',
      company: 'テックサーブ・ソリューションズ（B2B100社）',
      sector: 'ITサービス',
      location: '愛知県',
      quote:
        'APIで社内CRMと接続。2日で本番稼働。新規口コミごとにSalesforceに下書きが生成されます。ドキュメントもWebhookも信頼できます。',
      result: '2日でAPI本番 · 100社を自動化',
    },
    {
      name: '中村 あゆみ',
      role: '施設長',
      company: 'ゴールデン・ガーデンズ介護ホーム',
      sector: '医療・介護施設',
      location: '神奈川県',
      quote:
        '介護ではご家族の信頼が何より。REPUTEXAで誠実な返信を示せます。ソリダリティ価格のおかげで導入しやすくなりました。',
      result: '家族信頼指数+41% · 稼働率+8%',
    },
    {
      name: '渡辺 蓮',
      role: '創業者',
      company: '禅ヨガスタジオ',
      sector: 'スポーツ＆ウェルネス',
      location: '京都府',
      quote:
        '開始時はGoogleの口コミ15件。半年後は87件、4.9★。受付のQRで口コミ依頼するのが決め手でした。',
      result: '半年で15→87件 · ローカルMapsで3位→1位',
    },
    {
      name: '小林 真理',
      role: '広報責任者',
      company: 'Well+調剤チェーン（8店舗）',
      sector: '調剤・薬局',
      location: '中部地方',
      quote:
        'Shield Centerが2店舗への偽ネガ投稿の波を検知。不当競争の疑いです。REPUTEXAでGoogle異議申立て用の資料をすぐ作成し、ほとんどが72時間以内に削除されました。',
      result: '偽口コミ23件削除 · 8店舗を保護',
    },
    {
      name: '加藤 誠',
      role: 'マネージングディレクター',
      company: 'グラント不動産グループ（5拠点）',
      sector: '不動産',
      location: '沖縄県',
      quote:
        '不動産は信頼がすべて。口コミをきちんと運用してからGoogle経由リードの成約率が31%改善し、5拠点のメッセージも揃いました。',
      result: 'Googleリード成約+31% · 5拠点を統一',
    },
  ],
  globalMetrics: [
    { value: '3,200+', label: 'アクティブ拠点数' },
    { value: '+0.7★', label: '6か月の平均評価向上' },
    { value: '98%', label: '満足・非常に満足' },
    { value: '4.9★', label: 'G2のREPUTEXA評価' },
  ],
  allSectorsLabel: '全業種',
  ctaTitle: '評価を伸ばす3,200以上の事業者に参加',
  ctaBody: '14日間無料トライアル。カード不要。今日から信頼づくりを。',
  ctaButton: '無料で始める',
};

const ZH: TestimonialLocalePack = {
  partials: [
    {
      name: '陈思琪',
      role: '首席执行官',
      company: '蔚蓝酒店集团',
      sector: '酒店',
      location: '中国上海',
      quote:
        '使用 REPUTEXA 前，我们大约只回复 20% 的 Google 评价。现在 100% 都能在 24 小时内收到个性化回复。四个月内评分从 3.8 升到 4.7。Shield Center 还发现了一场协调一致的抹黑活动，单靠我们自己很难察觉。',
      result: '四个月 +0.9★ · 回复率 20%→100%',
    },
    {
      name: '王浩然',
      role: '店主',
      company: '庭院精酿餐吧',
      sector: '餐饮',
      location: '中国成都',
      quote:
        '作为餐饮老板，我曾担心 AI 回复会显得假。结果相反——客人以为是我本人写的。语气轻松友好，每周省下大约 8 小时。',
      result: '每周节省 8 小时 · 评分 4.2→4.6★',
    },
    {
      name: '李雨桐',
      role: '数字营销负责人',
      company: '普瑞玛医美诊所',
      sector: '健康与养生',
      location: '中国北京',
      quote:
        '医疗领域对评价非常敏感。REPUTEXA 让回复保持专业并符合医学伦理，合规向的 AI 过滤非常出色。',
      result: '评分 4.0→4.8★ · 转诊新患者 +23%',
    },
    {
      name: '张凯',
      role: '首席运营官',
      company: 'FLASH 美发连锁（12 家门店）',
      sector: '美业',
      location: '粤港澳大湾区',
      quote:
        '管理 12 家店和各自评价曾经一团糟。REPUTEXA 把一切集中起来，月度自动报告让我看清每家店——连锁必备。',
      result: '12 家门店 · 评价处理时间约减 90%',
    },
    {
      name: '刘婉清',
      role: '店主',
      company: '街坊奶酪铺',
      sector: '社区零售',
      location: '中国杭州',
      quote:
        '我是小本经营的工坊店，不是跨国企业。REPUTEXA 适合我们——简单、实惠、有效。Google 从 4.1 到 4.9★，都市圈客流也上来了。',
      result: '4.1→4.9★ · 地图曝光约翻倍',
    },
    {
      name: '赵明轩',
      role: '首席执行官',
      company: 'TechServ 解决方案（100 个 B2B 客户）',
      sector: 'IT 服务',
      location: '中国深圳',
      quote:
        '我们通过 API 把 REPUTEXA 接进自研 CRM。两天上线，每条新评价都会在 Salesforce 流程里生成草稿。文档清晰，Webhook 稳定。',
      result: '两天 API 上线 · 100 个客户自动化',
    },
    {
      name: '周静怡',
      role: '院长',
      company: '金园康养院',
      sector: '医养机构',
      location: '中国广州',
      quote:
        '康养机构最看重家属信任。REPUTEXA 让我们展现专业、及时的回复。公益定价计划也让我们用得起。',
      result: '家属信任指数 +41% · 入住率 +8%',
    },
    {
      name: '吴子涵',
      role: '创始人',
      company: '禅意瑜伽工作室',
      sector: '运动与健康',
      location: '中国南京',
      quote:
        '起步时 Google 只有 15 条评价。六个月后 87 条、4.9★。前台放二维码邀评是真正的转折点。',
      result: '六个月 15→87 条 · 本地地图从第 3 到第 1',
    },
    {
      name: '孙佳怡',
      role: '传播负责人',
      company: 'Well+ 药房连锁（8 家门店）',
      sector: '药房',
      location: '长三角',
      quote:
        'Shield Center 预警两家门店遭遇集中假差评，疑似恶性竞争。REPUTEXA 几下就生成 Google 申诉材料，多数在 72 小时内下架。',
      result: '移除 23 条虚假评价 · 保护 8 家门店',
    },
    {
      name: '马志远',
      role: '董事总经理',
      company: '格兰特地产集团（5 个办事处）',
      sector: '房地产',
      location: '中国青岛',
      quote:
        '房产行业信任就是一切。主动做好评价运营后，Google 线索转化提升 31%，五个网点口径也统一了。',
      result: 'Google 线索转化 +31% · 五个网点协同',
    },
  ],
  globalMetrics: [
    { value: '3,200+', label: '活跃门店/网点' },
    { value: '+0.7★', label: '6 个月平均评分提升' },
    { value: '98%', label: '满意或非常满意' },
    { value: '4.9★', label: 'G2 上的 REPUTEXA' },
  ],
  allSectorsLabel: '全部行业',
  ctaTitle: '加入 3,200+ 正在提升口碑的企业',
  ctaBody: '14 天免费试用，无需绑卡。今天就开始建立信任。',
  ctaButton: '免费开始',
};

export const TESTIMONIAL_LOCALE_PACKS: Partial<Record<SiteLocaleCode, TestimonialLocalePack>> = {
  de: DE,
  es: ES,
  it: IT,
  pt: PT,
  ja: JA,
  zh: ZH,
};
