import React, { useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { currentSession, requestSession, transition } from './core/session.mjs';

function Action({ children, onPress, secondary = false, disabled = false }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, (pressed || disabled) && styles.dim]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{children}</Text>
  </Pressable>;
}

export default function App() {
  const [purpose, setPurpose] = useState('');
  const [minutes, setMinutes] = useState('30');
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const counter = useRef(0);

  useEffect(() => {
    const refresh = () => setSession(previous => currentSession(previous));
    const timer = setInterval(refresh, 1000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);

  function act(action) {
    try {
      setSession(transition(session, action, { approved: action === 'start' }));
      setError('');
    } catch (failure) { setError(failure.message); }
  }

  function create() {
    try {
      if (!/^\d{1,3}$/.test(minutes.trim())) throw new Error('Enter a whole number from 1 to 120 minutes.');
      const next = requestSession({ id: `local-${Date.now()}-${++counter.current}`, purpose, minutes: Number(minutes) });
      setSession(next);
      setError('');
    } catch (failure) { setError(failure.message); }
  }

  const busy = session && ['pending', 'active'].includes(session.status);
  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <StatusBar barStyle="dark-content" />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>CODERS FOR HUMANITY</Text>
      <Text accessibilityRole="header" style={styles.title}>Tracking, with your say.</Text>
      <Text style={styles.lead}>A native session-control starter. Create a temporary session, review its purpose, then choose whether to start.</Text>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Development version · no data capture</Text>
        <Text style={styles.body}>No location, sensors or other apps are connected. Sessions stay in memory and disappear when the app restarts.</Text>
      </View>
      {!busy && <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>Create a local session</Text>
        <Text style={styles.label}>Purpose</Text>
        <TextInput accessibilityLabel="Session purpose" editable={!busy} value={purpose} onChangeText={setPurpose}
          maxLength={240} placeholder="What would this session be for?" style={styles.input} />
        <Text style={styles.label}>Duration in minutes · 1–120</Text>
        <TextInput accessibilityLabel="Duration in minutes" editable={!busy} value={minutes} onChangeText={setMinutes}
          maxLength={3} keyboardType="number-pad" style={styles.input} />
        <Action onPress={create}>Review session</Action>
      </View>}
      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
      {session && <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>Session review</Text>
        <Text accessibilityLiveRegion="polite" style={styles.status}>Status: {session.status}</Text>
        <Text style={styles.body}>{session.purpose}</Text>
        <Text style={styles.detail}>Created here · no connected app</Text>
        <Text style={styles.detail}>Expires {new Date(session.expiresAt).toLocaleTimeString()}</Text>
        {session.status === 'pending' && <>
          <Text style={styles.body}>Starting approves this temporary local session. This version records no tracking data.</Text>
          <Action onPress={() => act('start')}>Approve and start session</Action>
          <Action secondary onPress={() => act('deny')}>Decline</Action>
        </>}
        {session.status === 'active' && <>
          <Text style={styles.body}>Session approved. No tracking source is connected.</Text>
          <Action onPress={() => act('stop')}>Stop session</Action>
        </>}
        {['pending', 'active', 'stopped'].includes(session.status) &&
          <Action secondary onPress={() => act('revoke')}>Revoke session consent</Action>}
        {!busy && <Text style={styles.detail}>This session has ended. You can review a new session above.</Text>}
      </View>}
      <Text style={styles.footer}>Built for public-interest software. Live tracking and app-to-app delivery are pending implementation.</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f6f0' },
  content: { paddingTop: 64, paddingBottom: 48, paddingHorizontal: 24, maxWidth: 640, width: '100%', alignSelf: 'center', gap: 16 },
  eyebrow: { color: '#33564e', letterSpacing: 1.3, fontWeight: '700', fontSize: 12 },
  title: { fontSize: 38, fontWeight: '700', color: '#173d34', lineHeight: 43 },
  lead: { fontSize: 17, lineHeight: 26, color: '#40534c' },
  notice: { borderLeftWidth: 4, borderLeftColor: '#8b6a24', padding: 16, backgroundColor: '#eee9d8', gap: 8 },
  noticeTitle: { color: '#534416', fontWeight: '700', fontSize: 15 },
  section: { borderTopWidth: 1, borderTopColor: '#c9d2ca', paddingTop: 20, gap: 12 },
  heading: { color: '#173d34', fontSize: 23, fontWeight: '600' },
  label: { fontSize: 15, fontWeight: '600', color: '#263e34' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#80958b', borderRadius: 8, minHeight: 52, paddingHorizontal: 14, color: '#1a3428', fontSize: 17 },
  body: { color: '#30483d', fontSize: 16, lineHeight: 24 },
  detail: { color: '#4d6157', fontSize: 14, lineHeight: 21 },
  status: { color: '#175445', fontSize: 18, fontWeight: '700' },
  button: { minHeight: 52, borderRadius: 8, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#174f40' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: { borderWidth: 1, borderColor: '#628073', backgroundColor: 'transparent' },
  secondaryText: { color: '#234e3c' }, dim: { opacity: 0.6 },
  error: { color: '#9b271a', fontSize: 16, lineHeight: 23 },
  footer: { color: '#52665b', fontSize: 13, lineHeight: 20, paddingTop: 16 },
});
