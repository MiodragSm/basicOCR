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
import CameraRoll from '@react-native-camera-roll/camera-roll';

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
  // Scan history: array of { imageUri, extractedText, location, timestamp }
  const [history, setHistory] = useState([]);
  // Check and request geolocation permission on app start
  React.useEffect(() => {
    async function checkAndRequestLocationPermission() {
      if (Platform.OS === 'android') {
        const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (!hasPermission) {
          const granted = await requestAndroidPermission(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Dozvola za lokaciju',
              message: 'Aplikacija zahteva pristup vašoj lokaciji radi označavanja OCR skeniranja.',
              buttonPositive: 'U redu',
            }
          );
          if (!granted) {
            Alert.alert(
              'Permission Required',
              'Dozvola za lokaciju je potrebna za geooznačavanje skeniranja. Omogućite je u podešavanjima.',
              [{ text: 'U redu' }]
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
          message: 'Aplikacija zahteva pristup kameri za fotografisanje.',
          buttonPositive: 'U redu',
        }
      );
      if (!cameraGranted) {
        Alert.alert('Dozvola odbijena', 'Potrebna je dozvola za kameru.');
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
        if (response.didCancel) {return;}
        if (response.errorCode) {
          Alert.alert('Greška kamere', response.errorMessage || 'Nepoznata greška');
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
          title: 'Dozvola za skladištenje',
          message: 'Aplikacija zahteva pristup vašoj galeriji.',
          buttonPositive: 'U redu',
        }
      );
      if (!storageGranted) {
        Alert.alert('Dozvola odbijena', 'Potrebna je dozvola za skladištenje.');
        return;
      }
    }

    // Launch image library
    launchImageLibrary(
      {
        mediaType: 'photo',
      },
      async (response) => {
        if (response.didCancel) {return;}
        if (response.errorCode) {
          Alert.alert('Greška galerije', response.errorMessage || 'Nepoznata greška');
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
            title: 'Dozvola za lokaciju',
            message: 'Aplikacija zahteva vašu lokaciju za označavanje skeniranja.',
            buttonPositive: 'U redu',
          }
        );
        if (!locGranted) {throw new Error('Dozvola za lokaciju je odbijena');}
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
        setExtractedText(result.text.trim() ? result.text : 'Nije pronađen tekst.');
      } else {
        setExtractedText('Nije pronađen tekst.');
      }
    } catch (err) {
      setExtractedText('OCR nije uspeo: ' + (err.message || 'Nepoznata greška'));
    }
    setLoading(false);

    // Add scan to history
    setHistory((prev) => [
      {
        imageUri: uri,
        extractedText,
        location,
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);
};

  // Save photo to gallery (only for camera images)
  const handleSavePhoto = async () => {
    if (!imageUri || imageSource !== 'camera') {return;}
    setSaveStatus(null);

    try {
      // Request permission (Android)
      if (Platform.OS === 'android') {
        const writeGranted = await requestAndroidPermission(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'Aplikacija zahteva pristup skladištu za čuvanje fotografija.',
            buttonPositive: 'U redu',
          }
        );
        if (!writeGranted) {
          Alert.alert('Dozvola odbijena', 'Potrebna je dozvola za skladištenje.');
          return;
        }
      }
      await CameraRoll.save(imageUri, { type: 'photo' });
      setSaveStatus('Photo saved to gallery.');
      Alert.alert('Uspeh', 'Fotografija je sačuvana u galeriji.');
    } catch (err) {
      setSaveStatus('Failed to save photo.');
      Alert.alert('Greška', 'Neuspešno čuvanje fotografije: ' + (err.message || 'Nepoznata greška'));
    }
  };

  // Share extracted text
  const handleShareText = async () => {
    if (!extractedText || extractedText.startsWith('No text') || extractedText.startsWith('OCR failed')) {return;}
    try {
      await Share.share({ message: extractedText });
    } catch (err) {
      Alert.alert('Greška', 'Neuspešno deljenje teksta: ' + (err.message || 'Nepoznata greška'));
    }
  };

  // Copy extracted text to clipboard
  const handleCopyText = () => {
    if (!extractedText || extractedText.startsWith('No text') || extractedText.startsWith('OCR failed')) {return;}
    Clipboard.setString(extractedText);
    setCopyStatus('Kopirano!');
    setTimeout(() => setCopyStatus(null), 1500);
  };

  // Save extracted text to file
  const handleSaveTextToFile = async () => {
    if (!extractedText || extractedText.startsWith('No text') || extractedText.startsWith('OCR failed')) {return;}
    setSaveStatus(null);

    try {
      let dir = RNFS.DocumentDirectoryPath;
      let filePath = '';
      if (Platform.OS === 'android') {
        const apiLevel = Platform.Version;
        if (apiLevel >= 30) {
          // Android 11+ (Scoped Storage): use app-private directory
          dir = RNFS.DocumentDirectoryPath;
        } else if (RNFS.DownloadDirectoryPath) {
          // Android < 11: can use Downloads with permission
          const writeGranted = await requestAndroidPermission(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
              title: 'Dozvola za skladištenje',
              message: 'Aplikacija zahteva pristup skladištu za čuvanje fajlova u Preuzimanja.',
              buttonPositive: 'U redu',
            }
          );
          if (writeGranted) {
            dir = RNFS.DownloadDirectoryPath;
          } else {
            Alert.alert('Dozvola odbijena', 'Potrebna je dozvola za skladištenje. Čuvanje u privatnu memoriju aplikacije.');
            dir = RNFS.DocumentDirectoryPath;
          }
        }
      }
      filePath = `${dir}/ocr_result_${Date.now()}.txt`;
      await RNFS.writeFile(filePath, extractedText, 'utf8');
      setSaveStatus(`Tekst je sačuvan u fajl:\n${filePath}`);
      Alert.alert('Uspeh', `Tekst je sačuvan u fajl:\n${filePath}`);
    } catch (err) {
      setSaveStatus('Neuspešno čuvanje teksta.');
      Alert.alert('Greška', 'Neuspešno čuvanje teksta: ' + (err.message || 'Nepoznata greška'));
    }
  };

  // UI rendering
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>OCR aplikacija sa geolokacijom, čuvanjem i deljenjem</Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.actionButtonFixed} onPress={handleTakePhoto}>
          <Text style={styles.actionButtonTextFixed}>Fotografiši</Text>
        </TouchableOpacity>
        <View style={{ width: 16 }} />
        <TouchableOpacity style={styles.actionButtonFixed} onPress={handleSelectFromGallery}>
          <Text style={styles.actionButtonTextFixed}>Izaberi iz galerije</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Obrada u toku...</Text>
        </View>
      )}

      {imageUri && (
        <View style={styles.resultSection}>
          <Text style={styles.sectionTitle}>Slika:</Text>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        </View>
      )}

      {extractedText !== '' && (
        <View style={styles.resultSection}>
          <Text style={styles.sectionTitle}>Ekstrahovani tekst:</Text>
          <Text style={styles.textBlock}>
            {extractedText}
          </Text>
        </View>
      )}

      {location && (
        <View style={styles.resultSection}>
          <Text style={styles.sectionTitle}>Lokacija:</Text>
          <Text style={styles.textBlock}>
            Geografska širina: {location.latitude}{'\n'}Geografska dužina: {location.longitude}
          </Text>
        </View>
      )}
      {(!location && imageUri && !loading) && (
        <View style={styles.resultSection}>
          <Text style={styles.sectionTitle}>Lokacija:</Text>
          <Text style={styles.textBlock}>Lokacija nije dostupna.</Text>
        </View>
      )}

      {/* Save photo button (only for camera images) */}
      {imageUri && imageSource === 'camera' && (
        <TouchableOpacity style={styles.actionButton} onPress={handleSavePhoto}>
          <Text style={styles.actionButtonText}>Sačuvaj fotografiju u galeriju</Text>
        </TouchableOpacity>
      )}

      {/* Text actions: only if valid text */}
      {extractedText && !extractedText.startsWith('No text') && !extractedText.startsWith('OCR failed') && (
        <View style={styles.textActionsRow}>
          <TouchableOpacity style={styles.actionButtonFixed} onPress={handleShareText}>
            <Text style={styles.actionButtonTextFixed}>Podeli tekst</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButtonFixed} onPress={handleCopyText}>
            <Text style={styles.actionButtonTextFixed}>Kopiraj tekst</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButtonFixed} onPress={handleSaveTextToFile}>
            <Text style={styles.actionButtonTextFixed}>Sačuvaj tekst u fajl</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Feedback messages */}
      {saveStatus && (
        <Text style={styles.statusMessage}>{saveStatus && saveStatus.replace('Photo saved to gallery.', 'Fotografija je sačuvana u galeriji.').replace('Failed to save photo.', 'Neuspešno čuvanje fotografije.').replace('Text saved to file:', 'Tekst je sačuvan u fajl:').replace('Failed to save text.', 'Neuspešno čuvanje teksta.').replace('Permission Denied', 'Dozvola odbijena').replace('Saving to app-private storage instead.', 'Čuvanje u privatnu memoriju aplikacije.').replace('Storage permission is required.', 'Potrebna je dozvola za skladištenje.').replace('OCR failed', 'OCR nije uspeo')}</Text>
      )}
      {copyStatus && (
        <Text style={styles.statusMessage}>{copyStatus && copyStatus.replace('Copied!', 'Kopirano!')}</Text>
      )}

      <View style={{ height: 32 }} />
      {/* <Text style={styles.footer}>
        Pogledajte komentare u kodu za uputstva o podešavanju i dozvolama.
      </Text> */}
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
    width: '100%',
  },
  actionButtonFixed: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginHorizontal: 4,
    flex: 1,
    maxWidth: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonTextFixed: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
    textAlign: 'center',
    flexWrap: 'wrap',
    width: '100%',
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
