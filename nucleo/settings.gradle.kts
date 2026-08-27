// Só é lido no build autónomo. Quando o `android/settings.gradle` inclui este
// módulo, este ficheiro é ignorado e a versão do Kotlin vem do classpath da raiz.
pluginManagement {
    repositories {
        mavenCentral()
        gradlePluginPortal()
    }
    plugins { id("org.jetbrains.kotlin.jvm") version "2.0.21" }
}

rootProject.name = "nucleo"
