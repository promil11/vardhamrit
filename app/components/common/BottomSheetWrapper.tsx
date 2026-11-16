import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ViewStyle,
  Animated,
} from 'react-native';
import { theme } from '../../theme';

interface BottomSheetWrapperProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
}

export const BottomSheetWrapper: React.FC<BottomSheetWrapperProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  contentStyle,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheetContainer, contentStyle]}>
              {/* Drag Handle */}
              <View style={styles.handleWrapper}>
                <View style={styles.handle} />
              </View>

              {/* Optional Header */}
              {title ? (
                <View style={styles.headerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {title}
                    </Text>
                    {subtitle ? (
                      <Text style={styles.subtitle} numberOfLines={1}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={onClose}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={styles.closeIcon}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Body */}
              <View style={styles.body}>{children}</View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.xl,
    maxHeight: '85%',
    ...theme.shadows.modal,
  },
  handleWrapper: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.borderStrong,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.scale.md + 1,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: theme.typography.scale.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
  },
  closeIcon: {
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textSecondary,
  },
  body: {
    paddingVertical: theme.spacing.xs,
  },
});

export default BottomSheetWrapper;
