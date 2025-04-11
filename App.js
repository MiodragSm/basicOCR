// App.js
/**
 * React Native CLI OCR App with Geolocation, Save & Share Features
 *
 * This component allows users to:
 * - Take a photo or select an image from the gallery
 * - Perform OCR on the image using react-native-mlkit
 * - Geolocate each scan using react-native-geolocation-service
 * - Display the image, extracted text, and location
 * - Share, copy, or save the extracted text
 * - Save camera photos to the device gallery
 *
 * SETUP NOTES:
 * 1. Install required libraries:
 *    npm install react-native-image-picker react-native-mlkit react-native-geolocation-service @react-native-community/cameraroll react-native-fs @react-native-clipboard/clipboard
 *    # or
 *    yarn add react-native-image-picker react-native-mlkit react-native-geolocation-service @react-native-community/cameraroll react-native-fs @react-native-clipboard/clipboard
 *
 * 2. iOS only: cd ios && pod install
 *
 * 3. Android permissions (AndroidManifest.xml):
 *    <uses-permission android:name="android.permission.CAMERA" />
 *    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
 *    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28"/>
 *    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
 *    <!-- For Android 13+ -->
 *    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
 *    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
 *
 *    - For react-native-fs and CameraRoll, check their docs for storage permission requirements and Android SDK version notes (Scoped Storage).
 *
 * 4. iOS permissions (Info.plist):
 *    <key>NSCameraUsageDescription</key>
 *    <string>We need camera access to take photos for OCR.</string>
 *    <key>NSPhotoLibraryUsageDescription</key>
 *    <string>We need access to your photo library to select images.</string>
 *    <key>NSLocationWhenInUseUsageDescription</key>
 *    <string>We need your location to tag OCR scans.</string>
 *    <key>NSPhotoLibraryAddUsageDescription</key>
 *    <string>We need to save photos to your gallery.</string>
 *
 *    - If saving files outside app sandbox, add NSDocumentsUsageDescription (not needed for RNFS.DocumentDirectoryPath).
 *
 * 5. Consult the documentation for all external libraries for full native setup and troubleshooting.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Button,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  Share,
} from 'react-native';

// Image Picker for camera/gallery
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

// ML Kit for OCR
import TextRecognition from '@react-native-ml-kit/text-recognition';

// Geolocation
import Geolocation from 'react-native-geolocation-service';

// Save photo to gallery
import CameraRoll from 'react-native-cameraroll';

// Save text to file
import RNFS from 'react-native-fs';

// Copy to clipboard
import Clipboard from '@react-native-clipboard/clipboard';

// Helper: Request Android permissions at runtime
async function requestAndroidPermission(permission, rationale) {
  try {
    const granted = await PermissionsAndroid.request(permission, rationale);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    return false;
  }
}

const App = () => {
  // State variables
  const [imageUri, setImageUri] = useState(null); // URI of selected/captured image
  const [imageSource, setImageSource] = useState(null); // 'camera' or 'gallery'
  const [extractedText, setExtractedText] = useState(''); // OCR result
  const [location, setLocation] = useState(null); // { latitude, longitude }
  const [loading, setLoading] = useState(false); // Loading indicator
  const [saveStatus, setSaveStatus] = useState(null); // Success/error for saving photo/text
  const [copyStatus, setCopyStatus] = useState(null); // Feedback for copy action
  // Check and request geolocation permission on app start
  React.useEffect(() => {
    async function checkAndRequestLocationPermission() {
      if (Platform.OS === 'android') {
        const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (!hasPermission) {
          const granted = await requestAndroidPermission(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'This app needs access to your location to tag OCR scans.',
              buttonPositive: 'OK',
            }
          );
          if (!granted) {
            Alert.alert(
              'Permission Required',
              'Location permission is required for geotagging scans. Please enable it in settings.',
              [{ text: 'OK' }]
            );
          }
        }
      }
      // On iOS, permissions are handled by the OS prompt when using Geolocation
    }
    checkAndRequestLocationPermission();
  }, []);

  // Handle taking a photo with the camera
  const handleTakePhoto = async () => {
    setSaveStatus(null);
    setCopyStatus(null);
    setExtractedText('');
    setLocation(null);
    setImageUri(null);
    setImageSource(null);

    // Request camera permission (Android)
    if (Platform.OS === 'android') {
      const cameraGranted = await requestAndroidPermission(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'App needs camera access to take photos.',
          buttonPositive: 'OK',
        }
      );
      if (!cameraGranted) {
        Alert.alert('Permission Denied', 'Camera permission is required.');
        return;
      }
    }

    // Launch camera (saveToPhotos: false initially)
    launchCamera(
      {
        mediaType: 'photo',
        saveToPhotos: false,
      },
      async (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Camera Error', response.errorMessage || 'Unknown error');
          return;
        }
        if (response.assets && response.assets.length > 0) {
          const asset = response.assets[0];
          setImageUri(asset.uri);
          setImageSource('camera');
          await processImageAndLocation(asset.uri);
        }
      }
    );
  };

  // Handle selecting an image from the gallery
  const handleSelectFromGallery = async () => {
    setSaveStatus(null);
    setCopyStatus(null);
    setExtractedText('');
    setLocation(null);
    setImageUri(null);
    setImageSource(null);

    // Request storage permission (Android, for gallery access)
    if (Platform.OS === 'android') {
      const storageGranted = await requestAndroidPermission(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'App needs access to your gallery.',
          buttonPositive: 'OK',
        }
      );
      if (!storageGranted) {
        Alert.alert('Permission Denied', 'Storage permission is required.');
        return;
      }
    }

    // Launch image library
    launchImageLibrary(
      {
        mediaType: 'photo',
      },
      async (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Gallery Error', response.errorMessage || 'Unknown error');
          return;
        }
        if (response.assets && response.assets.length > 0) {
          const asset = response.assets[0];
          setImageUri(asset.uri);
          setImageSource('gallery');
          await processImageAndLocation(asset.uri);
        }
      }
    );
  };

  // Process image: get location, then OCR
  const processImageAndLocation = async (uri) => {
    setLoading(true);
    setExtractedText('');
    setLocation(null);

    // 1. Get geolocation
    let loc = null;
    try {
      // Request location permission
      if (Platform.OS === 'android') {
        const locGranted = await requestAndroidPermission(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'App needs your location to tag scans.',
            buttonPositive: 'OK',
          }
        );
        if (!locGranted) throw new Error('Location permission denied');
      }
      if (Platform.OS === 'ios') {
        // iOS: Geolocation permission is handled by Info.plist
      }
      await new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(
          (position) => {
            loc = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setLocation(loc);
            resolve();
          },
          (error) => {
            setLocation(null);
            resolve(); // Continue even if location fails
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
        );
      });
    } catch (err) {
      setLocation(null);
    }

    // 2. Perform OCR
    try {
      const result = await TextRecognition.recognize(uri);
      if (result && result.text) {
        setExtractedText(result.text.trim() ? result.text : 'No text detected.');
      } else {
        setExtractedText('No text detected.');
      }
    } catch (err) {
      setExtractedText('OCR failed: ' + (err.message || 'Unknown error'));
    }
    setLoading(false);
  };

  // Save photo to gallery (only for camera images)
  const handleSavePhoto = async () => {
    if (!imageUri || imageSource !== 'camera') return;
    setSaveStatus(null);

    try {
      // Request permission (Android)
      if (Platform.OS === 'android') {
        const writeGranted = await requestAndroidPermission(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs storage access to save photos.',
            buttonPositive: 'OK',
          }
        );
        if (!writeGranted) {
          Alert.alert('Permission Denied', 'Storage permission is required.');
          return;
        }
      }
      await CameraRoll.save(imageUri, { type: 'photo' });
      setSaveStatus('Photo saved to gallery.');
      Alert.alert('Success', 'Photo saved to gallery.');
    } catch (err) {
      setSaveStatus('Failed to save photo.');
      Alert.alert('Error', 'Failed to save photo: ' + (err.message || 'Unknown error'));
    }
  };

  // Share extracted text
  const handleShareText = async () => {
    if (!extractedText || extractedText.startsWith('No text') || extractedText.startsWith('OCR failed')) return;
    try {
      await Share.share({ message: extractedText });
    } catch (err) {
      Alert.alert('Error', 'Failed to share text: ' + (err.message || 'Unknown error'));
    }
  };

  // Copy extracted text to clipboard
  const handleCopyText = () => {
    if (!extractedText || extractedText.startsWith('No text') || extractedText.startsWith('OCR failed')) return;
    Clipboard.setString(extractedText);
    setCopyStatus('Copied!');
    setTimeout(() => setCopyStatus(null), 1500);
  };

  // Save extracted text to file
  const handleSaveTextToFile = async () => {
    if (!extractedText || extractedText.startsWith('No text') || extractedText.startsWith('OCR failed')) return;
    setSaveStatus(null);

    try {
      // Android: request storage permission if saving to Downloads
      let dir = RNFS.DocumentDirectoryPath;
      if (Platform.OS === 'android' && RNFS.DownloadDirectoryPath) {
        dir = RNFS.DownloadDirectoryPath;
        const writeGranted = await requestAndroidPermission(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs storage access to save files.',
            buttonPositive: 'OK',
          }
        );
        if (!writeGranted) {
          Alert.alert('Permission Denied', 'Storage permission is required.');
          return;
        }
      }
      const filePath = `${dir}/ocr_result_${Date.now()}.txt`;
      await RNFS.writeFile(filePath, extractedText, 'utf8');
      setSaveStatus(`Text saved to file:\n${filePath}`);
      Alert.alert('Success', `Text saved to file:\n${filePath}`);
    } catch (err) {
      setSaveStatus('Failed to save text.');
      Alert.alert('Error', 'Failed to save text: ' + (err.message || 'Unknown error'));
    }
  };

  // UI rendering
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>OCR App with Geolocation, Save & Share</Text>
      <View style={styles.buttonRow}>
        <Button title="Take Photo" onPress={handleTakePhoto} />
        <View style={{ width: 16 }} />
        <Button title="Select from Gallery" onPress={handleSelectFromGallery} />
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}

      {imageUri && (
        <View style={styles.resultSection}>
          <Text style={styles.sectionTitle}>Image:</Text>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        </View>
      )}

      {extractedText !== '' && (
        <View style={styles.resultSection}>
          <Text style={styles.sectionTitle}>Extracted Text:</Text>
          <Text style={styles.textBlock}>
            {extractedText}
          </Text>
        </View>
      )}

      {location && (
        <View style={styles.resultSection}>
          <Text style={styles.sectionTitle}>Location:</Text>
          <Text style={styles.textBlock}>
            Latitude: {location.latitude}{'\n'}Longitude: {location.longitude}
          </Text>
        </View>
      )}
      {(!location && imageUri && !loading) && (
        <View style={styles.resultSection}>
          <Text style={styles.sectionTitle}>Location:</Text>
          <Text style={styles.textBlock}>Location not available.</Text>
        </View>
      )}

      {/* Save photo button (only for camera images) */}
      {imageUri && imageSource === 'camera' && (
        <TouchableOpacity style={styles.actionButton} onPress={handleSavePhoto}>
          <Text style={styles.actionButtonText}>Save Photo to Gallery</Text>
        </TouchableOpacity>
      )}

      {/* Text actions: only if valid text */}
      {extractedText && !extractedText.startsWith('No text') && !extractedText.startsWith('OCR failed') && (
        <View style={styles.textActionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShareText}>
            <Text style={styles.actionButtonText}>Share Text</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleCopyText}>
            <Text style={styles.actionButtonText}>Copy Text</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleSaveTextToFile}>
            <Text style={styles.actionButtonText}>Save Text to File</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Feedback messages */}
      {saveStatus && (
        <Text style={styles.statusMessage}>{saveStatus}</Text>
      )}
      {copyStatus && (
        <Text style={styles.statusMessage}>{copyStatus}</Text>
      )}

      <View style={{ height: 32 }} />
      <Text style={styles.footer}>
        See code comments for setup instructions and permissions.
      </Text>
    </ScrollView>
  );
};

// Basic styling
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#F8F8F8',
    alignItems: 'stretch',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 18,
    textAlign: 'center',
    color: '#222',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 18,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#555',
  },
  resultSection: {
    marginVertical: 10,
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    elevation: 1,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#007AFF',
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    backgroundColor: '#EEE',
    marginBottom: 6,
  },
  textBlock: {
    fontSize: 16,
    color: '#333',
    marginTop: 2,
  },
  textActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 14,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginHorizontal: 4,
    minWidth: 90,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  statusMessage: {
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 15,
  },
  footer: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginTop: 24,
  },
});

export default App;