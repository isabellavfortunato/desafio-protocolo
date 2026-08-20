# Desafio 50 vídeos — aplicativo instalável e protegido

Aplicativo próprio que as participantes instalam pelo link no Android e no iPhone,
sem loja. Cada pessoa entra com e-mail e senha, os dados ficam no seu Firebase, as regras
impedem uma pessoa de mexer nos dados de outra e a leitura do print usa a sua chave da
Anthropic protegida no servidor. O passo a passo completo e bem detalhado está no
documento "Guia de instalação do Desafio 50 vídeos". Abaixo fica o resumo.

## Resumo das etapas
1. Firebase: crie o projeto, crie o Firestore, ative o provedor E-mail/senha em
   Authentication, cole as regras (abaixo) na aba Regras e registre um app da Web para
   pegar o firebaseConfig.
2. index.html: substitua cada COLE_AQUI do firebaseConfig pelos seus valores e escreva os
   e-mails da organização na lista MASTERS, logo abaixo, que já vem preenchida.
3. Anthropic: em console.anthropic.com adicione um crédito (mínimo cinco dólares) e crie
   uma chave (sk-ant-).
4. Netlify: arraste a pasta desafio para publicar. Em Environment variables crie duas
   variáveis: ANTHROPIC_API_KEY (a chave sk-ant-) e FIREBASE_WEB_API_KEY (o apiKey do
   firebaseConfig). Para receber o aviso do diário por e-mail, crie também RESEND_API_KEY
   e NOTIFY_TO, explicados mais abaixo. Opcional e recomendado: crie também SITE_ORIGIN com o endereço do
   seu site (por exemplo https://seu-site.netlify.app) para limitar a função à sua origem.
   Publique de novo.
5. Abra o link no celular e instale. No Android, Instalar aplicativo. No iPhone, Adicionar
   à Tela de Início.

## Os logins da organização
No topo do trecho de programação do index.html existe a lista MASTERS, já preenchida com
os quatro e-mails da organização. Quem entra com um desses e-mails ganha o botão
Organização, vê a pontuação de todas as participantes, lê o diário dos bastidores e é a
única pessoa que pode editar as atividades do dia e a lista de prêmios. A mesma lista está
repetida dentro das regras do Firestore, na função ehMaster, porque é a regra que protege
o diário de verdade. A lista do index.html só controla o que aparece na tela, então, ao
acrescentar ou tirar alguém, altere sempre nos dois lugares.

Cada uma dessas quatro pessoas precisa criar a conta dentro do aplicativo, com esse mesmo
e-mail e uma senha escolhida por ela. O e-mail estar na lista não cria a conta sozinho.

## Regras do Firestore (cole na aba Regras e publique)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function ehMaster() {
      return signedIn() && request.auth.token.email.lower() in [
        'isavfortunato@gmail.com',
        'contato@agenciatecla.com.br',
        'lyralibero@gmail.com',
        'davidsonpeixoto@hotmail.com'
      ];
    }
    match /config/main {
      allow read: if signedIn();
      allow write: if ehMaster();
    }
    match /participants/{uid} {
      allow read: if signedIn();
      allow write: if signedIn() && request.auth.uid == uid
        && request.resource.data.name is string
        && request.resource.data.name.size() <= 40;
    }
    match /days/{uid} {
      allow read: if signedIn();
      allow write: if signedIn() && request.auth.uid == uid;
    }
    match /videos/{id} {
      allow read: if signedIn();
      allow create: if signedIn()
        && request.resource.data.ownerId == request.auth.uid
        && request.resource.data.link is string
        && request.resource.data.link.size() <= 500;
      allow update, delete: if signedIn()
        && resource.data.ownerId == request.auth.uid;
    }
    match /insights/{id} {
      allow read: if signedIn();
      allow create: if signedIn()
        && request.resource.data.ownerId == request.auth.uid;
      allow update, delete: if signedIn()
        && resource.data.ownerId == request.auth.uid;
    }
    match /backstage/{id} {
      allow read: if signedIn();
      allow create: if signedIn()
        && request.resource.data.ownerId == request.auth.uid;
      allow update, delete: if signedIn()
        && resource.data.ownerId == request.auth.uid;
    }
    match /vents/{id} {
      allow read: if ehMaster() || (signedIn() && resource.data.ownerId == request.auth.uid);
      allow create: if signedIn()
        && request.resource.data.ownerId == request.auth.uid
        && request.resource.data.text is string
        && request.resource.data.text.size() <= 4000;
      allow update, delete: if signedIn()
        && resource.data.ownerId == request.auth.uid;
    }
    match /{document=**} { allow read, write: if false; }
  }
}
```

## Datas do desafio
O período está fixo dentro do index.html, nas constantes OPEN_KEY e START_KEY, logo acima
de DEFAULT_ACTIVITIES. O desafio abre em 25 de agosto de 2026, o primeiro dia que conta é
26 de agosto e o último é 24 de setembro, somando os 30 dias. Para mudar o período, basta
alterar essas duas datas e publicar de novo. Ninguém precisa apertar nada para começar,
porque o calendário já sabe qual é a janela.

## Atividades extras
Abaixo das três atividades do dia existe o botão Atividades extras, com uma estrela, que
abre a lista completa de tarefas opcionais. Cada participante marca o que fez naquele dia
e o número de extras marcadas aparece dentro do próprio botão. Essas marcações ficam na
mesma coleção days, no campo extras. A lista fica na constante EXTRA_ACTIVITIES do
index.html.

## TikTok Rats
É o quarto botão, junto de Ranking, Insights e Vídeos. O título fica no rosa da estrela,
centralizado. Dentro dele a participante envia a foto dos bastidores da gravação e marca o
botão Está pago, que muda de cor quando fica ativo. O botão do pago vale para o dia que
estiver selecionado no calendário e fica gravado na coleção days, no campo pagos, então
aparece mesmo antes de existir qualquer foto. Logo abaixo fica a caixa Desabafe comigo,
cujo conteúdo só os e-mails da organização enxergam, no botão Organização. As fotos são reduzidas dentro do
próprio celular antes do envio e ficam guardadas na coleção backstage, sem precisar do
Firebase Storage. Os desabafos ficam na coleção vents.

## Aviso por e-mail quando alguém escreve no diário
A função netlify/functions/notify.js manda um e-mail para a organização toda vez que uma
participante envia um texto no diário dos bastidores. O envio usa o Resend, que tem plano
gratuito. Crie a conta em resend.com, gere uma chave (começa com re_) e, no Netlify, em
Environment variables, crie RESEND_API_KEY com essa chave e NOTIFY_TO com os e-mails da
organização separados por vírgula. Publique de novo.

Duas variáveis são opcionais. NOTIFY_FROM define o remetente, e só vale a pena se você
verificar um domínio próprio no Resend; sem ela o aviso sai de onboarding@resend.dev.
NOTIFY_INCLUDE_TEXT com o valor nao faz o e-mail avisar que chegou um texto novo sem
copiar o conteúdo, para quem prefere ler apenas dentro do aplicativo.

Se você não configurar nada disso, o aplicativo continua funcionando igual, apenas sem o
aviso, e os textos seguem aparecendo no botão Organização.

## App Check (opcional, camada extra contra robôs)
No Firebase, em App Check, registre o app da Web com o provedor reCAPTCHA v3, copie a
chave de site e cole no campo recaptchaSiteKey do index.html, logo abaixo do
firebaseConfig. Publique de novo e só então ative a imposição para o Cloud Firestore.

## Segurança, em resumo
Cada participante tem uma conta própria de e-mail e senha, criada pelo Firebase, e o
aplicativo nunca guarda a senha. As regras impedem que uma pessoa altere os dados de
outra e mantêm o diário visível apenas para a autora e para os e-mails da
organização. A função da chave só responde a usuários autenticados do seu projeto, então
estranhos não gastam o seu crédito. A chave da Anthropic nunca aparece no navegador.
Mantenha um limite de gasto na Anthropic.

## Proteções da função de leitura do print
A função que lê o print só responde a usuários autenticados do seu projeto, recusa imagens
muito grandes, lê o token pelo cabeçalho (nunca pela URL) e, se você definir SITE_ORIGIN,
só aceita chamadas vindas do seu próprio site. As defesas principais contra abuso e custo
continuam sendo o App Check ligado e o limite de gasto na Anthropic.
