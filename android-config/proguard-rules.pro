# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ============================================
# REACT NATIVE PROGUARD RULES
# ============================================

# Keep React Native classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.modules.** { *; }
-keep class com.facebook.react.views.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

# Keep React Native interfaces
-keep interface com.facebook.react.bridge.** { *; }

# Keep React Native annotations
-keep @interface com.facebook.react.bridge.** { *; }

# Keep React Native modules
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod <methods>;
}

# Keep React Native package info
-keep class com.facebook.react.PackageList { *; }

# Keep Hermes classes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep SoLoader
-keep class com.facebook.soloader.** { *; }

# ============================================
# OKHTTP / NETWORKING
# ============================================

# OkHttp
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# Retrofit (if using)
-keep class retrofit2.** { *; }
-keep interface retrofit2.** { *; }
-dontwarn retrofit2.**

# Gson
-keep class com.google.gson.** { *; }
-keep class com.google.gson.stream.** { *; }
-keepattributes Signature
-keepattributes *Annotation*

# Keep your data models for Gson serialization
-keep class com.yourcompany.contactautopilot.models.** { *; }
-keepclassmembers class com.yourcompany.contactautopilot.models.** { *; }

# ============================================
# FIREBASE
# ============================================

# Firebase Core
-keep class com.google.firebase.** { *; }
-keep interface com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Firebase Analytics
-keep class com.google.android.gms.measurement.** { *; }
-keep class com.google.firebase.analytics.** { *; }

# Firebase Crashlytics
-keep class com.google.firebase.crashlytics.** { *; }
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception

# Firebase Cloud Messaging
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.android.gms.gcm.** { *; }

# Firebase Auth
-keep class com.google.firebase.auth.** { *; }
-keep class com.google.android.gms.auth.** { *; }

# Firebase Firestore
-keep class com.google.firebase.firestore.** { *; }
-keepclassmembers class com.google.firebase.firestore.** { *; }

# ============================================
# GOOGLE PLAY SERVICES
# ============================================

# Google Play Services
-keep class com.google.android.gms.** { *; }
-keep interface com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Google Sign-In
-keep class com.google.android.gms.auth.** { *; }
-keep class com.google.android.gms.common.** { *; }

# ============================================
# IN-APP PURCHASE (GOOGLE PLAY BILLING)
# ============================================

# Google Play Billing Library
-keep class com.android.billingclient.** { *; }
-keep interface com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

# Keep billing-related classes
-keep class com.yourcompany.contactautopilot.billing.** { *; }

# ============================================
# PUSH NOTIFICATIONS
# ============================================

# React Native Push Notifications
-keep class com.dieam.reactnativepushnotification.** { *; }
-keep class com.dieam.reactnativepushnotification.modules.** { *; }

# Firebase Messaging
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.android.gms.gcm.** { *; }

# Keep notification models
-keep class com.yourcompany.contactautopilot.notifications.** { *; }

# ============================================
# IMAGE LOADING (GLIDE)
# ============================================

# Glide
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep class * extends com.bumptech.glide.module.AppGlideModule {
 <init>(...);
}
-keep public enum com.bumptech.glide.load.ImageHeaderParser$** {
  **[] $VALUES;
  public *;
}
-keep class com.bumptech.glide.load.data.ParcelFileDescriptorRewinder$InternalRewinder {
  *** rewind();
}

# ============================================
# DATABASE (ROOM)
# ============================================

# Room
-keep class androidx.room.** { *; }
-keep interface androidx.room.** { *; }
-dontwarn androidx.room.**

# Keep Room entities
-keep class com.yourcompany.contactautopilot.database.entities.** { *; }
-keepclassmembers class com.yourcompany.contactautopilot.database.entities.** {
    @androidx.room.PrimaryKey <fields>;
    @androidx.room.ColumnInfo <fields>;
    @androidx.room.Embedded <fields>;
    @androidx.room.Relation <fields>;
}

# ============================================
# SECURITY
# ============================================

# AndroidX Security (Encrypted SharedPreferences)
-keep class androidx.security.** { *; }
-keep interface androidx.security.** { *; }
-dontwarn androidx.security.**

# Keep security-related classes
-keep class com.yourcompany.contactautopilot.security.** { *; }

# ============================================
# WORK MANAGER
# ============================================

# WorkManager
-keep class androidx.work.** { *; }
-keep interface androidx.work.** { *; }
-dontwarn androidx.work.**

# Keep worker classes
-keep class com.yourcompany.contactautopilot.workers.** { *; }
-keepclassmembers class com.yourcompany.contactautopilot.workers.** {
    <init>(...);
}

# ============================================
# BIOMETRIC AUTHENTICATION
# ============================================

# Biometric
-keep class androidx.biometric.** { *; }
-keep interface androidx.biometric.** { *; }
-dontwarn androidx.biometric.**

# ============================================
# THIRD-PARTY LIBRARIES
# ============================================

# React Native AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# React Native NetInfo
-keep class com.reactnativecommunity.netinfo.** { *; }

# React Native Device Info
-keep class com.learnium.RNDeviceInfo.** { *; }

# React Native Permissions
-keep class com.zoontek.rnpermissions.** { *; }

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }

# React Native Screens
-keep class com.swmansion.rnscreens.** { *; }

# React Native Safe Area Context
-keep class com.th3rdwave.safeareacontext.** { *; }

# React Native Vector Icons
-keep class com.oblador.vectoricons.** { *; }

# React Native Linear Gradient
-keep class com.BV.LinearGradient.** { *; }

# React Native WebView
-keep class com.reactnativecommunity.webview.** { *; }

# React Native Image Picker
-keep class com.imagepicker.** { *; }

# React Native Document Picker
-keep class com.reactnativedocumentpicker.** { *; }

# React Native Share
-keep class cl.json.** { *; }

# React Native Contacts
-keep class com.rt2zz.reactnativecontacts.** { *; }

# React Native Calendar Events
-keep class com.calendarevents.** { *; }

# React Native Localize
-keep class com.zoontek.rnlocalize.** { *; }

# React Native Keychain
-keep class com.oblador.keychain.** { *; }

# React Native FS
-keep class com.rnfs.** { *; }

# React Native Background Fetch
-keep class com.transistorsoft.rnbackgroundfetch.** { *; }

# React Native Background Geolocation
-keep class com.transistorsoft.rnbackgroundgeolocation.** { *; }

# ============================================
# APPLICATION CLASSES
# ============================================

# Keep your application class
-keep class com.yourcompany.contactautopilot.MainApplication { *; }

# Keep your main activity
-keep class com.yourcompany.contactautopilot.MainActivity { *; }

# Keep all classes in your package
-keep class com.yourcompany.contactautopilot.** { *; }
-keepclassmembers class com.yourcompany.contactautopilot.** { *; }

# ============================================
# SERIALIZATION
# ============================================

# Keep Serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Keep Parcelable classes
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}

# ============================================
# REFLECTION
# ============================================

# Keep annotations
-keepattributes *Annotation*

# Keep generic type information
-keepattributes Signature

# Keep class members for reflection
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ============================================
# ENUMS
# ============================================

# Keep enum classes
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ============================================
# NATIVE METHODS
# ============================================

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# ============================================
# VIEW BINDING
# ============================================

# Keep view binding classes
-keep class * extends android.view.View {
    <init>(android.content.Context);
    <init>(android.content.Context, android.util.AttributeSet);
    <init>(android.content.Context, android.util.AttributeSet, int);
}

# ============================================
# FRAGMENTS
# ============================================

# Keep fragment classes
-keep class * extends android.app.Fragment {
    <init>(...);
}
-keep class * extends androidx.fragment.app.Fragment {
    <init>(...);
}

# ============================================
# SERVICES
# ============================================

# Keep service classes
-keep class * extends android.app.Service {
    <init>(...);
}

# ============================================
# RECEIVERS
# ============================================

# Keep broadcast receiver classes
-keep class * extends android.content.BroadcastReceiver {
    <init>(...);
}

# ============================================
# PROVIDERS
# ============================================

# Keep content provider classes
-keep class * extends android.content.ContentProvider {
    <init>(...);
}

# ============================================
# REMOVE LOGGING IN RELEASE
# ============================================

# Remove Log calls in release builds
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int i(...);
    public static int w(...);
    public static int d(...);
    public static int e(...);
}

# Remove System.out.println calls
-assumenosideeffects class java.io.PrintStream {
    public void println(...);
    public void print(...);
}

# ============================================
# OPTIMIZATIONS
# ============================================

# Optimization passes
-optimizationpasses 5

# Allow access modification
-allowaccessmodification

# Merge interfaces aggressively
-mergeinterfacesaggressively

# ============================================
# WARNINGS
# ============================================

# Ignore warnings for specific packages
-dontwarn com.facebook.react.**
-dontwarn com.google.android.gms.**
-dontwarn com.google.firebase.**
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
-dontwarn com.android.billingclient.**
-dontwarn androidx.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.w3c.dom.bootstrap.DOMImplementationRegistry

# ============================================
# DEBUGGING
# ============================================

# Keep line numbers for debugging (disable for maximum obfuscation)
-keepattributes SourceFile,LineNumberTable

# Rename source file attribute
-renamesourcefileattribute SourceFile
