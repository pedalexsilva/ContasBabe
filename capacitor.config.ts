import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'pt.contasbabe',
  appName: 'ContasBabe',
  webDir: 'dist',
  android: {
    // A UI é toda local; nada aqui carrega de um servidor.
    allowMixedContent: false,
  },
  plugins: {
    FirebaseAuthentication: {
      // O login corre pelo Google Sign-In do sistema, não numa WebView: é o
      // que evita o `disallowed_useragent` e o que dá ao serviço em Kotlin
      // uma sessão que ele possa herdar.
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
}

export default config
