// android/app/build.gradle
// This is a template for your React Native Android app build.gradle

plugins {
    id "com.android.application"
    id "com.facebook.react"
    // Firebase Google Services plugin
    id "com.google.gms.google-services"
    // Crashlytics plugin (optional but recommended)
    id "com.google.firebase.crashlytics"
}

import com.android.build.OutputFile

/**
 * The react.gradle file registers a task for each build variant (e.g. bundleDebugJsAndAssets
 * and bundleReleaseJsAndAssets).
 * These basically call `react-native bundle` with the correct arguments during the Android build
 * cycle. By default, bundleDebugJsAndAssets is skipped, as in debug/dev mode we prefer to load the
 * bundle directly from the development server. Below you can see all the possible configurations
 * and their defaults. If you decide to add a configuration block, make sure to add it before the
 * `apply from: "../../node_modules/@react-native-community/cli-platform-android/native_modules.gradle"` line.
 */

android {
    // Required: Target API Level 34 (Android 14) as of 2024
    compileSdkVersion 34
    
    // Namespace for the app
    namespace "com.contactautopilot"

    defaultConfig {
        // Application ID - must match your Play Console app
        applicationId "com.yourcompany.contactautopilot"
        
        // Minimum SDK - Android 7.0 (API 24) covers ~95% of devices
        minSdkVersion rootProject.ext.minSdkVersion
        
        // Target SDK - Must be 34 for Play Store submissions
        targetSdkVersion 34
        
        // Version code - increment for each release
        versionCode 1
        
        // Version name - user-visible version
        versionName "1.0.0"
        
        // Required for some React Native libraries
        multiDexEnabled true
        
        // NDK ABI filters - optimize for supported architectures
        ndk {
            abiFilters "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        }
    }

    // Signing configuration for release builds
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        
        release {
            // Use environment variables or local.properties for security
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
            
            // Alternative: Use system environment variables for CI/CD
            /*
            storeFile file(System.getenv("UPLOAD_KEYSTORE_PATH") ?: "release.keystore")
            storePassword System.getenv("UPLOAD_KEYSTORE_PASSWORD")
            keyAlias System.getenv("UPLOAD_KEY_ALIAS")
            keyPassword System.getenv("UPLOAD_KEY_PASSWORD")
            */
        }
    }

    buildTypes {
        debug {
            signingConfig signingConfigs.debug
            // Enable debugging in debug builds
            debuggable true
        }
        
        release {
            signingConfig signingConfigs.release
            
            // Enable code shrinking and obfuscation
            minifyEnabled true
            
            // Enable resource shrinking
            shrinkResources true
            
            // ProGuard configuration files
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            
            // Disable debugging in release builds
            debuggable false
            
            // Enable crash reporting
            firebaseCrashlytics {
                mappingFileUploadEnabled true
            }
        }
    }

    // Configure APK splits for smaller download sizes
    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
            universalApk false
        }
    }

    // Application variants configuration
    applicationVariants.all { variant ->
        variant.outputs.each { output ->
            // For each separate APK per architecture, set a unique version code
            def versionCodes = ["armeabi-v7a": 1, "arm64-v8a": 2, "x86": 3, "x86_64": 4]
            def abi = output.getFilter(OutputFile.ABI)
            if (abi != null) {
                output.versionCodeOverride =
                        defaultConfig.versionCode * 1000 + versionCodes.get(abi)
            }
        }
    }

    // Packaging options
    packagingOptions {
        pickFirst '**/libc++_shared.so'
        pickFirst '**/libjsc.so'
    }
}

dependencies {
    // React Native core
    implementation fileTree(dir: "libs", include: ["*.jar"])
    implementation("com.facebook.react:react-android")
    
    // Hermes engine (recommended for React Native)
    implementation("com.facebook.react:hermes-android")
    
    // Multidex support
    implementation 'androidx.multidex:multidex:2.0.1'
    
    // Firebase BOM (Bill of Materials) - manages Firebase versions
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    
    // Firebase Analytics
    implementation 'com.google.firebase:firebase-analytics'
    
    // Firebase Crashlytics
    implementation 'com.google.firebase:firebase-crashlytics'
    
    // Firebase Cloud Messaging (Push Notifications)
    implementation 'com.google.firebase:firebase-messaging'
    
    // Firebase Authentication (if using)
    implementation 'com.google.firebase:firebase-auth'
    
    // Firebase Firestore (if using)
    implementation 'com.google.firebase:firebase-firestore'
    
    // Google Play Services - Base
    implementation 'com.google.android.gms:play-services-base:18.2.0'
    
    // Google Play Services - Auth (for Google Sign-In)
    implementation 'com.google.android.gms:play-services-auth:20.7.0'
    
    // AndroidX Core
    implementation 'androidx.core:core-ktx:1.12.0'
    
    // AndroidX AppCompat
    implementation 'androidx.appcompat:appcompat:1.6.1'
    
    // Material Design Components
    implementation 'com.google.android.material:material:1.11.0'
    
    // Constraint Layout
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    
    // Lifecycle components
    implementation 'androidx.lifecycle:lifecycle-runtime-ktx:2.7.0'
    implementation 'androidx.lifecycle:lifecycle-common-java8:2.7.0'
    
    // Security library for encrypted SharedPreferences
    implementation 'androidx.security:security-crypto:1.1.0-alpha06'
    
    // WorkManager for background tasks
    implementation 'androidx.work:work-runtime-ktx:2.9.0'
    
    // Room database (if using local database)
    implementation 'androidx.room:room-runtime:2.6.1'
    annotationProcessor 'androidx.room:room-compiler:2.6.1'
    
    // Networking - OkHttp
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    implementation 'com.squareup.okhttp3:logging-interceptor:4.12.0'
    
    // Image loading - Glide (optional)
    implementation 'com.github.bumptech.glide:glide:4.16.0'
    annotationProcessor 'com.github.bumptech.glide:compiler:4.16.0'
    
    // JSON parsing - Gson (optional)
    implementation 'com.google.code.gson:gson:2.10.1'
    
    // In-App Purchase - Google Play Billing Library
    implementation 'com.android.billingclient:billing:6.1.0'
    implementation 'com.android.billingclient:billing-ktx:6.1.0'
    
    // Testing dependencies
    testImplementation 'junit:junit:4.13.2'
    androidTestImplementation 'androidx.test.ext:junit:1.1.5'
    androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'
}

// Run this once to be able to run the application with BUCK
// puts all compile dependencies into folder libs for BUCK to use
// task copyDownloadableDepsToLibs(type: Copy) {
//     from configurations.implementation
//     into 'libs'
// }

// React Native CLI configuration
apply from: file("../../node_modules/@react-native-community/cli-platform-android/native_modules.gradle")
applyNativeModulesAppBuildGradle(project)
