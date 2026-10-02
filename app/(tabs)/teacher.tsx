import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import { COLORS, TINTS } from '@/constants/colors';
import { HIT, RADIUS, SHADOWS, SPACING, TEXT } from '@/constants/theme';
import { createEvent } from '@/lib/events';
import { buildQRPayload } from '@/lib/qr';
import { useRole } from '@/lib/useRole';

function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

function formatDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  return `${month} ${pad(date.getDate())}, ${date.getFullYear()} at ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const QUICK_END_OPTIONS = [
  { label: '+30 min', ms: 30 * 60 * 1000 },
  { label: '+1 hour', ms: 60 * 60 * 1000 },
  { label: '+2 hours', ms: 2 * 60 * 60 * 1000 },
];

type EditTarget = 'start' | 'end';

export default function TeacherScreen() {
  const { role, loading: roleLoading } = useRole();
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');
  const [payload, setPayload] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAndroid = Platform.OS === 'android';

  const openPicker = (target: EditTarget) => {
    setMessage(null);
    setEditTarget(target);
    setEditingPart('date');
  };

  const onPickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!editTarget) return;
    if (event.type === 'dismissed' || !selected) {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }

    const current = editTarget === 'start' ? startDate : endDate;
    const next = new Date(current);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (editTarget === 'start') setStartDate(next);
    else setEndDate(next);

    if (isAndroid && editingPart === 'date') {
      setEditingPart('time');
    } else {
      setEditTarget(null);
      setEditingPart('date');
    }
  };

  const handleQuickEnd = (ms: number) => {
    setMessage(null);
    setEndDate(new Date(startDate.getTime() + ms));
  };

  const handleCreateEvent = () => {
    const event = {
      eventId: eventId.trim(),
      title: title.trim(),
      start: toLocalISO(startDate),
      end: toLocalISO(endDate),
    };

    if (!event.eventId || !event.title) {
      setMessage('Event title and code are required.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setMessage('End time must be after start time.');
      return;
    }

    createEvent(event).then(({ error }) => {
      if (error) {
        setMessage('Could not save the event. Please try again.');
        return;
      }
      setMessage('Event saved! Scan the QR with the Scan tab to test it.');
      setPayload(buildQRPayload(event));
    });
  };

  if (roleLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.lockedTitle}>Checking your account...</Text>
      </View>
    );
  }

  if (role !== 'teacher') {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <View style={styles.stateCard}>
          <View style={styles.stateIcon}>
            <Ionicons name="lock-closed-outline" size={44} color={COLORS.primary} />
          </View>
          <Text style={styles.lockedTitle}>Teachers Only</Text>
          <Text style={styles.lockedSubtitle}>
            Only teacher accounts can create events.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Create Event QR</Text>
      <Text style={styles.subtitle}>
        Fill in the event details, then scan the generated QR with the Scan tab.
      </Text>

      <View style={styles.formCard}>
        <Text style={styles.label}>Event Title</Text>
        <View style={styles.inputWrap}>
          <Ionicons
            name="text-outline"
            size={18}
            color={COLORS.primary}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Founders Day Assembly"
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>

        <Text style={styles.label}>Event Code</Text>
        <View style={styles.inputWrap}>
          <Ionicons
            name="pricetag-outline"
            size={18}
            color={COLORS.primary}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            value={eventId}
            onChangeText={setEventId}
            placeholder="e.g. EVT-2026-0002"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="characters"
          />
        </View>

        <Text style={styles.label}>Starts</Text>
        <PickerField
          value={formatDateTime(startDate)}
          icon="sunny-outline"
          onPress={() => openPicker('start')}
        />

        <Text style={styles.label}>Ends</Text>
        <PickerField
          value={formatDateTime(endDate)}
          icon="moon-outline"
          onPress={() => openPicker('end')}
        />
        <View style={styles.chipRow}>
          {QUICK_END_OPTIONS.map((option) => (
            <Pressable
              key={option.label}
              style={styles.chip}
              onPress={() => handleQuickEnd(option.ms)}
            >
              <Text style={styles.chipText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>Tap a chip to set the end time from start.</Text>
      </View>

      {message && <Text style={styles.message}>{message}</Text>}

      <AppButton
        theme="primary"
        title="Create Event"
        icon="add-circle-outline"
        onPress={handleCreateEvent}
      />

      {editTarget && (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={editTarget === 'start' ? startDate : endDate}
            mode={isAndroid ? editingPart : 'datetime'}
            display={isAndroid ? 'default' : 'spinner'}
            onChange={onPickerChange}
          />
        </View>
      )}

      {payload && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            Scan this QR code with the Scan tab:
          </Text>
          <View style={styles.qrBox}>
            <QRCode value={payload} size={200} />
          </View>
          <Text style={styles.payloadText}>{payload}</Text>
        </View>
      )}
    </ScrollView>
  );
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function PickerField({ value, icon, onPress }: PickerFieldProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.pickerField, pressed && styles.pickerFieldPressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <Text style={styles.pickerValue}>{value}</Text>
      <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  lockedTitle: {
    ...TEXT.title,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xxs,
  },
  lockedSubtitle: {
    ...TEXT.meta,
    textAlign: 'center',
    lineHeight: 21,
  },
  title: {
    ...TEXT.display,
    marginBottom: SPACING.xxs,
  },
  subtitle: {
    ...TEXT.meta,
    lineHeight: 21,
    marginBottom: SPACING.lg,
  },
  formCard: {
    backgroundColor: TINTS.white,
    borderRadius: RADIUS.card,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.card,
  },
  label: {
    ...TEXT.label,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TINTS.wash,
    borderRadius: RADIUS.field,
    paddingHorizontal: SPACING.md,
    minHeight: HIT.min + 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    paddingVertical: SPACING.sm,
  },
  inputIcon: {
    marginRight: SPACING.xs,
  },
  pickerField: {
    backgroundColor: TINTS.wash,
    borderRadius: RADIUS.field,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    minHeight: HIT.min + 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerFieldPressed: {
    backgroundColor: TINTS.washDeep,
    opacity: 0.9,
  },
  pickerValue: {
    flex: 1,
    ...TEXT.body,
    fontWeight: '600',
    marginHorizontal: SPACING.sm,
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },
  chip: {
    minHeight: HIT.min,
    justifyContent: 'center',
    backgroundColor: TINTS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.md,
    marginRight: SPACING.xs,
  },
  chipText: {
    ...TEXT.chip,
    color: COLORS.primaryInk,
  },
  hint: {
    ...TEXT.hint,
    marginTop: SPACING.xs,
  },
  pickerContainer: {
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  message: {
    ...TEXT.chip,
    color: COLORS.primaryInk,
    textAlign: 'center',
    marginTop: SPACING.md,
    backgroundColor: TINTS.wash,
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    overflow: 'hidden',
  },
  resultCard: {
    backgroundColor: TINTS.white,
    borderRadius: RADIUS.card,
    padding: SPACING.xl,
    marginTop: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  resultTitle: {
    ...TEXT.cardTitle,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  qrBox: {
    backgroundColor: TINTS.white,
    padding: SPACING.lg,
    borderRadius: RADIUS.tile,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: TINTS.wash,
  },
  payloadText: {
    ...TEXT.hint,
    textAlign: 'center',
    lineHeight: 18,
  },
  stateCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    backgroundColor: TINTS.white,
    borderRadius: RADIUS.card,
    padding: SPACING.xl,
    ...SHADOWS.card,
  },
  stateIcon: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.pill,
    backgroundColor: TINTS.wash,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
});