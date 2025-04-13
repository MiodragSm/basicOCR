# React Native OCR App with Geolocation, Save & Share Features

## Overview

This React Native CLI application enables users to scan text from images using their device's camera or gallery, automatically tags each scan with geolocation data, and provides options to save camera photos, as well as share, copy, or save the extracted text. The app is designed for robust error handling and a smooth user experience, with clear feedback for all actions.

---

## Features

- **OCR from device camera:** Take a photo and extract text using ML Kit.
- **OCR from device gallery:** Select an image from the gallery for text recognition.
- **Geolocation tagging:** Each scan is tagged with the device's current location.
- **Save camera photos:** Optionally save photos taken with the camera to the device gallery.
- **Share extracted text:** Use the native share dialog to send text via messaging, email, etc.
- **Copy extracted text:** Copy recognized text to the device clipboard.
- **Save extracted text to file:** Store the text as a `.txt` file in the device's Documents or Downloads directory.
- **Display of image, text, and location:** Results are clearly shown in the UI.
- **User feedback and error handling:** All actions provide user feedback and handle errors gracefully.

---

## Technology Stack

- **React Native CLI**
- [react-native-image-picker](https://github.com/react-native-image-picker/react-native-image-picker)
- [react-native-mlkit](https://github.com/baronha/react-native-mlkit)
- [react-native-geolocation-service](https://github.com/Agontuk/react-native-geolocation-service)
- [@react-native-community/cameraroll](https://github.com/react-native-cameraroll/react-native-cameraroll)
- [react-native-fs](https://github.com/itinance/react-native-fs)
- [@react-native-clipboard/clipboard](https://github.com/react-native-clipboard/clipboard)
- **React Native Share API** (built-in)
- **JavaScript / ES6+**

---

## User Interface (Brief)

- **Main Actions:** Two buttons at the top: "Take Photo" and "Select from Gallery".
- **Results Display:** Shows the selected/captured image, extracted text, and geolocation data.
- **Conditional Actions:**
  - "Save Photo to Gallery" button appears only for camera images.
  - "Share Text", "Copy Text", and "Save Text to File" buttons appear only when valid text is extracted.
- **Feedback:** Success/error messages are shown for all actions.

---

## Setup and Installation

### Prerequisites

- Node.js, npm/yarn, and React Native CLI installed.
- Xcode (for iOS) or Android Studio (for Android) set up for native development.

### Clone the Repository

```sh
git clone https://github.com/MiodragSm/basicOCR.git
cd basicOCR
```

### Install Dependencies

```sh
npm install react-native-image-picker react-native-mlkit react-native-geolocation-service @react-native-community/cameraroll react-native-fs @react-native-clipboard/clipboard
# or
yarn add react-native-image-picker react-native-mlkit react-native-geolocation-service @react-native-community/cameraroll react-native-fs @react-native-clipboard/clipboard
```

### iOS Only

```sh
cd ios && pod install
```

### Crucial Native Configuration

#### Android (`android/app/src/main/AndroidManifest.xml`)

Add the following permissions:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<!-- For Android 13+ -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
```

- For `react-native-fs` and CameraRoll, check their documentation for storage permission requirements and Android SDK version notes (Scoped Storage).
- You may need to update `build.gradle` or `settings.gradle` for some libraries (see their docs).

#### iOS (`ios/YourApp/Info.plist`)

Add the following keys:

```xml
<key>NSCameraUsageDescription</key>
<string>We need camera access to take photos for OCR.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to your photo library to select images.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to tag OCR scans.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>We need to save photos to your gallery.</string>
```

- If saving files outside the app sandbox, add `NSDocumentsUsageDescription` (not needed for `RNFS.DocumentDirectoryPath`).

#### General

- **Always consult the official documentation for all external libraries** for the most accurate and current native setup instructions, troubleshooting, and platform-specific notes.

---

## Running the Application

```sh
# For Android
npx react-native run-android

# For iOS
npx react-native run-ios
```

---

## Important Notes

- **OCR and Geolocation Accuracy:** Results depend on device hardware and environmental conditions.
- **Permissions:** The app requires camera, location, and storage permissions. Android storage permissions may vary by SDK version (Scoped Storage).
- **File Saving Location:** Text files are saved to the Documents or Downloads directory (see code and RNFS docs).
- **Native Setup:** Some libraries require additional native configuration. Always check the documentation for [ML Kit](https://github.com/baronha/react-native-mlkit), [Geolocation](https://github.com/Agontuk/react-native-geolocation-service), [FS](https://github.com/itinance/react-native-fs), [CameraRoll](https://github.com/react-native-cameraroll/react-native-cameraroll), and [Clipboard](https://github.com/react-native-clipboard/clipboard).

---

## Screenshots

*Add screenshots here to showcase the app UI and features.*

---

## Future Enhancements

- History of scans with search/filter.
- Map view of geotagged scans.
- Multi-language OCR support.
- Export all results as CSV or PDF.

---

**For any issues or questions, please refer to the official documentation of the libraries used, or open an issue in this repository.**
