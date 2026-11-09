# 👻 Fantasma – app dos entregadores (Ghosts)

App React Native (Expo **SDK 58**, roda no **Expo Go**) para os entregadores do Açaí Mania.
Usa o **mesmo banco Supabase** do site. Os entregadores se chamam **Ghosts**.

- Login com **usuário e senha** criados pelo admin no site (não há cadastro pelo app).
- **Trava de localização**: sem permissão de localização ou com o GPS desligado, o app fica bloqueado ("Ative a localização para destravar").
- **Mapa** de Aquidauana + Anastácio (Leaflet + OpenStreetMap) que funciona **sem internet** depois de baixado.
- **Painel da direita**: entregas na ordem da rota (a 1ª é a mais perto de você, a próxima é a mais perto da anterior), com Pegar / Coletado / Entregue, Google Maps, Waze e WhatsApp do cliente.
- **Bonequinho à esquerda**: perfil com foto **ou fantasminha** (6 opções), nome, WhatsApp, **chave Pix**, números, Online/Offline e Sair.
- **🏆 Ranking** (canto superior direito): semana e mês, com o prêmio definido pela loja e a sua posição destacada.
- **💸 Ganhos** (no perfil): hoje, semana, saldo a receber, últimos pagamentos e cada entrega (frete + bônus + evento). Pagamento semanal por Pix.
- **🎉 Eventos**: áreas com bônus extra aparecem como círculos dourados no mapa, com faixa de aviso embaixo.
- **🔥 Áreas de mais saída**: mancha de calor no mapa (liga/desliga no botão 🔥).
- **Pedidos parados pulsam** (estilo Pokémon Go): disponível há mais de X minutos (a loja define; padrão 8) pulsa, e mais forte com o tempo.
- **Rota travada até a entrega** e botão **➤ seguir** (o mapa acompanha você; arrastar o mapa desliga).
- Tela de carregamento com fantasminha flutuando e novo ícone.

---

## 1. Banco de dados (uma vez)

No **Supabase › SQL Editor**, rode os arquivos **`supabase/07_fantasma.sql`**, **`08_frota_empresa.sql`** e **`09_eventos_ranking_ganhos.sql`** do repositório do site (branch `fantasma`), nessa ordem.
Eles precisam que 04, 05 e 06 já tenham sido rodados. Podem rodar mais de uma vez sem problema. (No projeto atual os três já estão aplicados.)

## 2. Site (uma vez)

1. Publique a branch **`fantasma`** do repositório `Acai-mania` (ou faça merge dela na branch que a Vercel publica).
2. Na **Vercel › seu projeto do site › Settings › Environment Variables**, crie:
   - Nome: `SUPABASE_SERVICE_ROLE_KEY`
   - Valor: Supabase › **Project Settings › API** › chave **service_role** (ou "secret").
   - **Não** use o prefixo `NEXT_PUBLIC_`. Essa chave fica só no servidor e nunca vai para o navegador nem para o app.
3. Faça **Redeploy** do site.

## 3. Criar um Ghost (admin)

1. Entre em **/admin** no site com a conta de admin.
2. Aba **Ghosts** › preencha **Usuário** (ex.: `joao`), **Senha** (mínimo 6), **Nome** e **WhatsApp** › **Criar Ghost**.
3. Passe o usuário e a senha para o entregador. No app ele digita só `joao` (sem e-mail).
4. Na mesma aba: **Trocar senha** e **Desativar/Ativar** (desativado não consegue entrar).

> Por dentro: o usuário vira o e-mail `joao@fantasma.app` no Supabase Auth, já confirmado. Usuário aceita letras, números, `.`, `_` e `-` (3 a 30), sem espaço; maiúsculas e acentos são convertidos (`João` → `joao`).

## 4. Rodar no celular (Windows)

Pré-requisitos: **Node.js 20 ou mais novo** (https://nodejs.org) e o app **Expo Go** atualizado no celular (versão para **SDK 58**). Computador e celular na **mesma rede Wi-Fi**.

### Opção A – pasta nova (recomendado)

Abra o **PowerShell** e rode:

```powershell
cd C:\Users\gii91\OneDrive\Documentos\EntregaPH2
Expand-Archive -Path "$HOME\Downloads\fantasma-app.zip" -DestinationPath .\fantasma
cd .\fantasma
npm install
npx expo start
```

### Opção B – substituir o conteúdo de `delivery-driver`

O projeto antigo é SDK 57 e não abre no seu Expo Go. Para reaproveitar a pasta:

```powershell
cd C:\Users\gii91\OneDrive\Documentos\EntregaPH2\delivery-driver
Remove-Item -Recurse -Force .\* 
Expand-Archive -Path "$HOME\Downloads\fantasma-app.zip" -DestinationPath .
npm install
npx expo start
```

(`Remove-Item` apaga tudo que está dentro de `delivery-driver`. Se tiver algo seu lá, copie antes.)

### Depois do `npx expo start`

- Aparece um **QR code** no terminal. No Android, abra o **Expo Go** › **Scan QR code**. No iPhone, use a **Câmera**.
- Se o celular não conectar (rede diferente, firewall), rode `npx expo start --tunnel`.
- Se aparecer erro de versão, confira se o Expo Go é o mais novo (SDK 58). O `package.json` usa `expo ~58.0.23`.

> Dica: a pasta do OneDrive sincroniza o `node_modules` (milhares de arquivos) e pode deixar tudo lento. Se ficar lento, use uma pasta fora do OneDrive, por exemplo `C:\dev\fantasma`.

### Arquivo `.env`

O zip já vem com um `.env` apontando para o mesmo Supabase do site (os mesmos valores padrão do app web do motoboy).
Se o site usar outro projeto Supabase, edite o `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-ou-publishable
```

Use a chave **anon/publishable**, **nunca** a service_role. Depois de mudar o `.env`, pare o Expo (Ctrl+C) e rode `npx expo start -c`.

## 5. Mapa offline

1. Com **Wi-Fi**, abra o app › toque no **bonequinho** (canto esquerdo) › **Mapa offline** › **Baixar mapa offline**.
2. São **871 imagens** do mapa (zoom 12 a 16, caixa de Aquidauana + Anastácio), cerca de 10 a 20 MB. Leva alguns minutos: o download é feito devagar de propósito (2 conexões, pausa entre imagens), como pede a política do OpenStreetMap.
3. Pode tocar em **Parar** e continuar depois (as imagens já baixadas são puladas).
4. Pronto: o mapa abre sem internet. Fora da caixa ou se faltar alguma imagem, ele usa o mapa online. Com o mapa baixado, aproximar além do zoom 16 amplia as imagens do 16 (fica menos nítido, mas funciona offline).

Sem internet, o mapa e a última lista de entregas continuam aparecendo, mas **pegar/coletar/entregar precisa de internet** (as ações vão direto para o banco).

## 6. Como funciona

- **Online/Offline**: chave no perfil (ou toque no selo no topo do mapa). Offline, o Ghost **não vê nem pega entregas disponíveis** e **não envia a posição** (isso é garantido também no banco, pelo RLS e pelas funções). As entregas que já estão com ele continuam aparecendo.
- **Localização**: enquanto o app está aberto e Online, a posição é enviada para a loja (`courier_ping`) no máximo a cada 15 s (ou antes, se andou mais de 40 m). O admin vê no **Mapa ao vivo**.
- **Rota**: ordem pelo vizinho mais próximo (haversine). A linha vai da sua posição até a loja (se ainda falta coletar) e depois às entregas, e fica no mapa até entregar: com internet, o traçado pelas ruas vem do OSRM e é refeito quando você sai da rota (> 70 m) ou a cada 30 s se andou 100 m; se o OSRM falhar, fica a última rota boa; sem nenhuma, linha tracejada reta. O trecho já percorrido some.
- **Seguir (➤)**: o mapa fica centrado em você. Arrastar o mapa desliga; ⤢ mostra tudo.
- **Ganhos**: cada entrega concluída rende o **frete inteiro** pago pelo cliente + **bônus** por entrega + **extra de evento** (se a entrega for dentro da área). A loja paga toda semana (segunda a domingo) por Pix e marca como pago no /admin.
- **Áreas de mais saída**: grade de ~500 m com os pedidos das últimas 2 horas + a média do mesmo dia da semana e horário nas últimas 8 semanas (sem nenhum dado de cliente).
- **Coletado**: só depois que a loja muda o pedido para "Em preparo". **Entregue**: pede confirmação.

## 7. Limitações (importante)

- **Expo Go não faz localização em segundo plano.** A posição só é enviada com o app **aberto na tela**. Se o Ghost trocar de app ou bloquear a tela, a posição para de atualizar até ele voltar.
  - Próximo passo para segundo plano: gerar um **development build** (`npx expo install expo-task-manager`, usar `Location.startLocationUpdatesAsync` com uma tarefa registrada no `TaskManager`, pedir permissão "Permitir o tempo todo" com `requestBackgroundPermissionsAsync`, e compilar com `eas build --profile development`). Isso não roda no Expo Go.
- O traçado pelas ruas usa o servidor de demonstração do OSRM (grátis, sem garantia). Se falhar, fica a linha reta.
- Testado no computador: `tsc` sem erros, `expo export --platform android` gerou o bundle, `expo-doctor` 20/20, e a página do mapa rodou num navegador simulado (jsdom). **Não foi testado num celular de verdade**: o primeiro teste no seu aparelho é a validação real (principalmente o mapa offline lendo os arquivos locais).

## Estrutura

```
App.tsx                       sessão, trava de localização, telas
src/screens/LoginScreen.tsx   login por usuário
src/screens/HomeScreen.tsx    mapa + painel de rota + botão do perfil
src/screens/ProfileScreen.tsx perfil, fantasminha, Pix, números, online/offline, mapa offline, sair
src/screens/RankingScreen.tsx ranking semana/mês + prêmio
src/screens/EarningsScreen.tsx ganhos e pagamentos
src/components/GhostLoader.tsx  tela de carregamento animada
src/lib/useRouteLine.ts       rota travada até a entrega (OSRM + fallback)
assets/ghosts/                os 6 fantasminhas
src/components/LocationGate.tsx  tela "Ative a localização para destravar"
src/map/                      Leaflet embutido (WebView), tiles offline
src/lib/                      supabase, rota (haversine/vizinho mais próximo), hooks
```
