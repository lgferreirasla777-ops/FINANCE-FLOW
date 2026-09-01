# Finance Flow — projeto standalone

Este é o mesmo app que você viu no Claude, agora como um projeto React completo
que roda fora do Claude, na sua própria conta de hospedagem.

O que mudou em relação ao artifact:
- A gravação de dados agora usa `localStorage` do navegador (antes usava um
  recurso interno do Claude). Isso significa que os dados ficam salvos no
  aparelho/navegador que você usar para acessar o site.

## 1. Testar no seu computador (opcional, mas recomendado)

Requisitos: ter o **Node.js** instalado (baixe em nodejs.org, versão 18 ou
mais recente).

No terminal, dentro da pasta do projeto:

```bash
npm install
npm run dev
```

Isso abre o app em `http://localhost:5173` no seu navegador, já funcionando
como vai funcionar depois de publicado.

## 2. Publicar de graça na internet (Vercel)

1. Crie uma conta em **vercel.com** (pode entrar com sua conta do GitHub).
2. Crie um repositório novo no **GitHub** e suba esta pasta inteira nele
   (pode arrastar os arquivos direto na interface do GitHub, ou usar `git`).
3. No painel da Vercel, clique em **"Add New Project"**, selecione esse
   repositório e clique em **Deploy**. A Vercel detecta automaticamente que é
   um projeto Vite/React — não precisa configurar nada.
4. Em 1–2 minutos você recebe uma URL, algo como
   `https://finance-flow-seunome.vercel.app`. Esse é o seu site, no ar,
   funcionando de qualquer lugar.

(Netlify funciona do mesmo jeito, se preferir usar ele no lugar da Vercel.)

## 3. Transformar em app Android instalável (antes da Play Store)

Depois que o site estiver publicado com uma URL própria:

1. Acesse **pwabuilder.com**.
2. Cole a URL do seu site publicado.
3. Escolha a opção **Android** e baixe o pacote gerado (arquivo `.aab`).

Esse `.aab` é o que a Google Play Store pede para publicar um app.

## 4. Publicar na Play Store

1. Acesse **play.google.com/console** e crie uma conta de desenvolvedor
   (taxa única de US$ 25 — essa parte só você pode fazer, é vinculada à sua
   conta Google e forma de pagamento).
2. Crie um novo app, envie o arquivo `.aab` do passo 3.
3. Preencha a ficha da loja: nome, descrição, categoria, capturas de tela do
   app (pode tirar prints do próprio app rodando no navegador do celular) e
   uma política de privacidade (obrigatória — pode ser uma página simples
   explicando que os dados ficam salvos apenas no aparelho do usuário).
4. Envie para revisão. Costuma levar de algumas horas a poucos dias.

## Estrutura do projeto

```
finance-flow-app/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── manifest.webmanifest
└── src/
    ├── main.jsx
    └── App.jsx      ← todo o app está aqui
```
