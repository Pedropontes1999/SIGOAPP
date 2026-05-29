import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';

export default function WelcomeScreen({ navigation }) {
  // Solicita permissão de GPS antes de ir para o login de parceira
  // GPS é usado para registrar localização em cada evento do trajeto
  async function entrarComoParceira() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      } else {
        Alert.alert(
          'GPS necessário',
          'Sem acesso ao GPS as localizações não serão registradas no relatório.',
          [{ text: 'Entendi' }]
        );
      }
    } catch {
      Alert.alert(
        'GPS necessário',
        'Sem acesso ao GPS as localizações não serão registradas no relatório.',
        [{ text: 'Entendi' }]
      );
    }
    navigation.navigate('LoginForm');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#212E3E" />

      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>SIG</Text>
            <Image
              source={require('../../assets/sigo-symbol.png')}
              style={styles.logoSymbol}
              resizeMode="contain"
            />
            <View style={styles.logoDivider} />
            <View style={styles.logoTaglineBlock}>
              <Text style={styles.logoTaglineTop}>Sistema Integrado</Text>
              <Text style={styles.logoTaglineBottom}>Gestão de Obras</Text>
            </View>
          </View>
        </View>

        {/* Botão Parceira: fluxo de terceirizados (solicita GPS antes) */}
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={entrarComoParceira}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Parceira</Text>
        </TouchableOpacity>

        {/* Botão Interno: fiscais e supervisores, sem GPS */}
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => navigation.navigate('LoginInterno')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnSecondaryText}>EDP</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#212E3E' },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 64,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  logoText: {
    fontSize: 72,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  logoSymbol: {
    width: 72,
    height: 72,
    marginTop: 4,
  },
  logoDivider: {
    width: 2,
    height: 52,
    backgroundColor: '#94A3B8',
    marginHorizontal: 14,
    borderRadius: 1,
  },
  logoTaglineBlock: {
    justifyContent: 'center',
  },
  logoTaglineTop: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  logoTaglineBottom: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#53FF75',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 4,
  },
  btnPrimaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#212E3E',
    letterSpacing: 0.5,
  },
  btnSecondary: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#394658',
  },
  btnSecondaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#E4E4E7',
    letterSpacing: 0.5,
  },
});
