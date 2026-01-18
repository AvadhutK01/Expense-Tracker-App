import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Toast from "react-native-toast-message";
import SendIntentAndroid from "react-native-send-intent";
import { Linking } from "react-native";
import tw from "tailwind-react-native-classnames";

const PAYTM_PACKAGE = "net.one97.paytm";

interface Props {
  amount: string;
  onFallback?: () => void;
}

const UPIScanner: React.FC<Props> = ({ amount, onFallback }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const isPermissionGranted = Boolean(permission?.granted);

  // Append amount to UPI URL
  const appendAmountToUPI = (upiUrl: string, amount: string) => {
    try {
      const url = new URL(upiUrl);
      url.searchParams.set("am", amount);
      url.searchParams.set("cu", "INR");
      return url.toString();
    } catch {
      return `${upiUrl}&am=${amount}&cu=INR`;
    }
  };

  // Handle scanned QR code
  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (scanned) return;
      setScanned(true);

      if (data.startsWith("upi://pay")) {
        try {
          const upiUrl = appendAmountToUPI(data, amount);
          await Linking.openURL(upiUrl);
        } catch (error) {
          console.log("UPI redirect error:", error);
          Toast.show({ type: "error", text1: "Failed to open Paytm" });
          setScanned(false);
        }
      } else {
        Toast.show({ type: "error", text1: "Invalid QR Code" });
        setScanned(false);
      }
    },
    [amount, scanned]
  );

  // Manual fallback to Paytm
  const handleFallback = async () => {
    try {
      await SendIntentAndroid.openApp(PAYTM_PACKAGE, {});
    } catch {
      Toast.show({ type: "error", text1: "Could not launch Paytm" });
      if (onFallback) onFallback();
    }
  };

  // Requesting permission
  if (!permission) {
    return (
      <View style={tw`flex-1 justify-center items-center`}>
        <ActivityIndicator size="large" color="blue" />
        <Text style={tw`mt-2 text-gray-700`}>
          Checking camera permissions...
        </Text>
      </View>
    );
  }

  // If no permission granted yet
  if (!isPermissionGranted) {
    return (
      <SafeAreaView style={tw`flex-1 justify-center items-center`}>
        <Text style={tw`text-red-500 text-center mb-4`}>
          Camera access is required to scan QR codes.
        </Text>

        <TouchableOpacity
          onPress={requestPermission}
          style={tw`bg-green-600 px-5 py-3 rounded-xl mb-3`}
        >
          <Text style={tw`text-white font-semibold`}>Request Permission</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleFallback}
          style={tw`bg-blue-600 px-5 py-3 rounded-xl`}
        >
          <Text style={tw`text-white font-semibold`}>Open Paytm Manually</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Main camera view
  return (
    <SafeAreaView style={tw`flex-1`}>
      {Platform.OS === "android" ? <StatusBar hidden /> : null}

      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {scanned && (
        <View style={tw`absolute bottom-8 w-full items-center`}>
          <TouchableOpacity
            onPress={() => setScanned(false)}
            style={tw`bg-blue-600 px-5 py-3 rounded-xl`}
          >
            <Text style={tw`text-white font-semibold`}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manual Fallback */}
      <View style={tw`absolute top-10 w-full items-center`}>
        <TouchableOpacity
          onPress={handleFallback}
          style={tw`bg-gray-800 px-4 py-2 rounded-xl`}
        >
          <Text style={tw`text-white font-semibold`}>
            Unable to scan QR? Click here
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default UPIScanner;
