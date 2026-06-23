import { useRef, useState } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { WorkspaceStyles } from '@/components/workspaces/WorkspaceBits';
import type { ItineraryNode } from '@/models';
import {
  displayInlineFieldValue,
  inlineFieldValue,
  shouldSaveInlineField,
  validateInlineFieldValue,
  type ActiveInlineEdit,
  type InlineFieldKey,
  type InlineFieldValue,
} from '@/services/planning/inlineEdit';
import { dayCardStyles } from './DayCard.styles';

type InlineOption = {
  value: string;
  label: string;
};

type InlineEditorProps = {
  node: ItineraryNode;
  field: InlineFieldKey;
  activeInlineEdit: ActiveInlineEdit;
  label: string;
  isDark: boolean;
  loading: boolean;
  disabled: boolean;
  styles: WorkspaceStyles;
  onStart: (nodeId: string, field: InlineFieldKey) => boolean;
  onCancel: () => void;
  onSave: (node: ItineraryNode, field: InlineFieldKey, value: InlineFieldValue) => Promise<void>;
  onDraftChange: (changed: boolean) => void;
  placeholder?: string;
  inputStyle?: StyleProp<ViewStyle>;
  inactiveStyle?: StyleProp<ViewStyle>;
  inactiveValueStyle?: StyleProp<TextStyle>;
  showInactiveLabel?: boolean;
};

export function InlineEditableField(props: InlineEditorProps) {
  return <InlineEditableCore {...props} multiline={false} />;
}

export function InlineEditableTextArea(props: InlineEditorProps) {
  return <InlineEditableCore {...props} multiline />;
}

function InlineEditableCore(props: InlineEditorProps & { multiline: boolean }) {
  const {
    node,
    field,
    activeInlineEdit,
    label,
    isDark,
    loading,
    disabled,
    styles,
    onStart,
    onCancel,
    onSave,
    onDraftChange,
    placeholder,
    inputStyle,
    inactiveStyle,
    inactiveValueStyle,
    showInactiveLabel = true,
    multiline,
  } = props;
  const isActive = activeInlineEdit?.nodeId === node.id && activeInlineEdit.field === field;
  const [draft, setDraft] = useState(inlineFieldValue(node, field));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  function beginEdit() {
    if (!onStart(node.id, field)) {
      return;
    }

    setDraft(inlineFieldValue(node, field));
    setError(null);
    onDraftChange(false);
  }

  function cancelEdit() {
    if (savingRef.current || isSaving) {
      return;
    }

    setDraft(inlineFieldValue(node, field));
    setError(null);
    onDraftChange(false);
    onCancel();
  }

  async function saveEdit() {
    if (savingRef.current || isSaving || loading) {
      return;
    }

    const validation = validateInlineFieldValue(node, field, draft);
    if (!validation.valid) {
      setError(validation.error ?? 'Kontrollera fÃ¤ltet.');
      return;
    }

    if (!shouldSaveInlineField(node, field, draft)) {
      cancelEdit();
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(node, field, draft);
      onCancel();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Kunde inte spara fÃ¤ltet.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  if (!isActive) {
    return (
      <Pressable
        style={[dayCardStyles.inlineDisplayField, inactiveStyle, disabled && styles.disabledButton]}
        onPress={beginEdit}
        disabled={disabled}
      >
        {showInactiveLabel ? <Text style={[dayCardStyles.inlineDisplayLabel, isDark && styles.textMutedDark]}>{label}</Text> : null}
        <Text style={[dayCardStyles.inlineDisplayValue, isDark && styles.textDark, inactiveValueStyle]}>{displayInlineFieldValue(node, field)}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.quickCell, inputStyle, isDark && styles.inputDark]}>
      <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>{label}</Text>
      <TextInput
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          onDraftChange(shouldSaveInlineField(node, field, text));
        }}
        placeholder={placeholder ?? label}
        placeholderTextColor={isDark ? '#737373' : '#78716c'}
        multiline={multiline}
        onKeyPress={(event) => {
          if (event.nativeEvent.key === 'Escape') {
            cancelEdit();
          }
          if (!multiline && event.nativeEvent.key === 'Enter') {
            void saveEdit();
          }
        }}
        style={[
          styles.quickCell,
          multiline && { minHeight: 84, textAlignVertical: 'top' },
          isDark && styles.inputDark,
        ]}
        editable={!isSaving && !loading}
      />
      {error ? <Text style={styles.validationText}>{error}</Text> : null}
      <View style={styles.stopActions}>
        <Pressable style={[styles.smallButton, (isSaving || loading) && styles.disabledButton]} onPress={() => void saveEdit()} disabled={isSaving || loading}>
          <Text style={styles.smallButtonText}>{isSaving ? 'Sparar...' : 'âœ“'}</Text>
        </Pressable>
        <Pressable style={styles.secondarySmallButton} onPress={cancelEdit} disabled={isSaving}>
          <Text style={styles.secondarySmallButtonText}>Ã—</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function InlineEditableSelect(props: InlineEditorProps & { options: InlineOption[] }) {
  const {
    node,
    field,
    activeInlineEdit,
    label,
    isDark,
    loading,
    disabled,
    styles,
    onStart,
    onCancel,
    onSave,
    onDraftChange,
    inactiveStyle,
    inactiveValueStyle,
    showInactiveLabel = true,
    options,
  } = props;
  const isActive = activeInlineEdit?.nodeId === node.id && activeInlineEdit.field === field;
  const [draft, setDraft] = useState(inlineFieldValue(node, field));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  function beginEdit() {
    if (!onStart(node.id, field)) {
      return;
    }

    setDraft(inlineFieldValue(node, field));
    setError(null);
    onDraftChange(false);
  }

  async function saveEdit(value = draft) {
    if (savingRef.current || isSaving || loading) {
      return;
    }

    const validation = validateInlineFieldValue(node, field, value);
    if (!validation.valid) {
      setError(validation.error ?? 'Kontrollera fÃ¤ltet.');
      return;
    }

    if (!shouldSaveInlineField(node, field, value)) {
      onDraftChange(false);
      onCancel();
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(node, field, value);
      onDraftChange(false);
      onCancel();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Kunde inte spara fÃ¤ltet.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  if (!isActive) {
    return (
      <Pressable
        style={[dayCardStyles.inlineDisplayField, inactiveStyle, disabled && styles.disabledButton]}
        onPress={beginEdit}
        disabled={disabled}
      >
        {showInactiveLabel ? <Text style={[dayCardStyles.inlineDisplayLabel, isDark && styles.textMutedDark]}>{label}</Text> : null}
        <Text style={[dayCardStyles.inlineDisplayValue, isDark && styles.textDark, inactiveValueStyle]}>{displayInlineFieldValue(node, field)}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.quickCell, isDark && styles.inputDark]}>
      <Text style={[styles.itemMeta, isDark && styles.textMutedDark]}>{label}</Text>
      <View style={styles.quickTypeRow}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.quickTypeChip, draft === option.value && styles.quickTypeChipActive, (isSaving || loading) && styles.disabledButton]}
            onPress={() => {
              setDraft(option.value);
              onDraftChange(shouldSaveInlineField(node, field, option.value));
              void saveEdit(option.value);
            }}
            disabled={isSaving || loading}
          >
            <Text style={[styles.quickTypeChipText, draft === option.value && styles.quickTypeChipTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.validationText}>{error}</Text> : null}
      <View style={styles.stopActions}>
        <Pressable style={styles.secondarySmallButton} onPress={onCancel} disabled={isSaving}>
          <Text style={styles.secondarySmallButtonText}>Avbryt</Text>
        </Pressable>
      </View>
    </View>
  );
}
