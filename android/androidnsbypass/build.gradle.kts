plugins {
    id("com.android.library")
}

android {
    namespace = "dev.alexytomi.androidnsbypass"
    compileSdk = 36
    ndkVersion = "27.0.12077973"

    buildFeatures {
        prefabPublishing = true
    }

    defaultConfig {
        ndk { abiFilters += "arm64-v8a" }
        minSdk = 26 // This is sort of a lie, the lib turns itself off on versions below sdk24
                    // I don't want to figure out android 4 compiling so uh, you get this.
        externalNativeBuild {
            cmake {
                cppFlags("-std=c++17")
                arguments("-DANDROID_STL=c++_shared", "-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON")
            }
        }
    }

    externalNativeBuild {
        cmake {
            path("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }

    prefab {
        create("androidnsbypass") {
            headers = "src/main/cpp/include"
        }
    }

    buildTypes {
        getByName("debug") {
            matchingFallbacks += listOf("debug")
        }

        create("proguard") {
            matchingFallbacks += listOf("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}
