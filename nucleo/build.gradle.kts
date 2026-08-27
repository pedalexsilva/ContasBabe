// Sem versão de propósito. Este módulo compila de duas maneiras:
//
//  - autónomo (`cd nucleo && ./gradlew test`), e aí a versão vem do
//    `pluginManagement` do settings.gradle.kts;
//  - como subprojeto do build Android, e aí vem do classpath do buildscript da
//    raiz, que já tem o kotlin-gradle-plugin.
//
// Declarar a versão aqui parte o segundo caso na fase de configuração, com um
// "plugin is already on the classpath with an unknown version" — antes de
// compilar um único ficheiro.
plugins { kotlin("jvm") }

repositories { mavenCentral() }

dependencies { testImplementation(kotlin("test")) }

kotlin { jvmToolchain(21) }

tasks.test { useJUnitPlatform() }
