plugins {
    java
}

group = "com.mio"

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.javassist:javassist:3.29.2-GA")
    testImplementation("org.junit.jupiter:junit-jupiter:5.8.2")
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

tasks.test {
    useJUnitPlatform()
}

tasks.jar {
    manifest {
        attributes(
            "Manifest-Version" to "1.0",
            "Premain-Class" to "com.mio.libpatcher.MainAgent",
            "Agent-Class" to "com.mio.libpatcher.MainAgent",
            "Can-Redefine-Classes" to true,
            "Can-Retransform-Classes" to true
        )
    }
    from(configurations.runtimeClasspath.get().map { if (it.isDirectory) it else zipTree(it) })
    exclude("META-INF/*.SF", "META-INF/*.DSA", "META-INF/*.RSA")
}

// Compile the unchanged Java 8 API surface using the available JDK 21.
tasks.withType<JavaCompile>().configureEach { options.release.set(8) }

