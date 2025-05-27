import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';

const App = () => {
  const [currentView, setCurrentView] = useState('schedule');
  const [activeTask, setActiveTask] = useState<number | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [showSafetyDialog, setShowSafetyDialog] = useState(false);
  const [incompleteReason, setIncompleteReason] = useState('');
  const [currentTaskId, setCurrentTaskId] = useState<number | null>(null);
  const [raAcknowledged, setRaAcknowledged] = useState(false);
  const [swmsAcknowledged, setSwmsAcknowledged] = useState(false);
  
  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: "Mow Riverside Park - East Section",
      location: "Riverside Park, East Lawn",
      estimatedHours: 2.5,
      priority: "high" as const,
      status: "assigned" as const,
      equipment: ["Ride-on Mower #3", "Fuel Container"],
      startTime: null as string | null,
      endTime: null as string | null,
      incompleteReason: null as string | null,
      riskAssessment: {
        title: "Ride-on Mower Operation - RA-2024-015",
        hazards: [
          "Moving machinery parts",
          "Noise exposure (85+ dB)",
          "Fuel handling",
          "Slopes and uneven terrain",
          "Flying debris"
        ],
        controls: [
          "Pre-start equipment inspection",
          "Wear hearing protection",
          "Maintain 10m exclusion zone",
          "Check slope gradient <15°",
          "Wear safety glasses and closed footwear"
        ]
      },
      swms: {
        title: "Large Area Mowing Procedure - SWMS-2024-008",
        steps: [
          "Conduct pre-start safety check of mower",
          "Inspect area for obstacles, debris, and hazards",
          "Set up safety barriers and signage",
          "Don required PPE (hearing, eye protection)",
          "Start mowing following planned pattern",
          "Maintain awareness of public and other workers",
          "Complete post-operation checks and cleaning"
        ],
        ppe: ["Safety glasses", "Hearing protection", "High-vis vest", "Closed shoes"]
      }
    },
    {
      id: 2,
      title: "Trim Hedges - Main Street Median",
      location: "Main Street Median Strip",
      estimatedHours: 1.5,
      priority: "medium" as const,
      status: "assigned" as const,
      equipment: ["Hedge Trimmer #2", "Safety Cones"],
      startTime: null as string | null,
      endTime: null as string | null,
      incompleteReason: null as string | null,
      riskAssessment: {
        title: "Hedge Trimming Near Traffic - RA-2024-023",
        hazards: [
          "Vehicle traffic proximity",
          "Power tool operation",
          "Flying debris",
          "Repetitive strain",
          "Sharp cutting blades"
        ],
        controls: [
          "Install traffic control devices",
          "Maintain 2m buffer from roadway",
          "Regular tool maintenance",
          "Rotate workers every 30 minutes",
          "Blade guards and emergency stops"
        ]
      },
      swms: {
        title: "Roadside Hedge Maintenance - SWMS-2024-012",
        steps: [
          "Set up traffic control (cones, signs)",
          "Inspect hedge trimmer and safety features",
          "Clear work area of pedestrians",
          "Position spotter for traffic watch",
          "Begin trimming from traffic-side outward",
          "Collect and dispose of trimmings",
          "Remove traffic control devices"
        ],
        ppe: ["High-vis vest", "Safety glasses", "Cut-resistant gloves", "Hard hat"]
      }
    }
  ]);

  const startTaskWithSafety = (taskId: number) => {
    setCurrentTaskId(taskId);
    setRaAcknowledged(false);
    setSwmsAcknowledged(false);
    setShowSafetyDialog(true);
  };

  const confirmSafetyAndStart = () => {
    if (raAcknowledged && swmsAcknowledged && currentTaskId) {
      setTasks(tasks.map(task => 
        task.id === currentTaskId 
          ? { ...task, status: 'in-progress' as const, startTime: new Date().toLocaleTimeString() }
          : task
      ));
      setActiveTask(currentTaskId);
      setShowSafetyDialog(false);
      setCurrentTaskId(null);
    } else {
      Alert.alert('Safety Acknowledgment Required', 'You must read and acknowledge both the Risk Assessment and SWMS before starting this task.');
    }
  };

  const stopTask = (taskId: number) => {
    setCurrentTaskId(taskId);
    setShowCompleteDialog(true);
  };

  const handleTaskComplete = () => {
    if (currentTaskId) {
      setTasks(tasks.map(task => 
        task.id === currentTaskId 
          ? { ...task, status: 'completed' as const, endTime: new Date().toLocaleTimeString() }
          : task
      ));
      setActiveTask(null);
      setShowCompleteDialog(false);
      setCurrentTaskId(null);
    }
  };

  const handleTaskIncomplete = () => {
    setShowCompleteDialog(false);
    setShowReasonDialog(true);
  };

  const submitIncompleteTask = () => {
    if (incompleteReason.trim() && currentTaskId) {
      setTasks(tasks.map(task => 
        task.id === currentTaskId 
          ? { 
              ...task, 
              status: 'needs-rescheduling' as const, 
              endTime: new Date().toLocaleTimeString(),
              incompleteReason: incompleteReason
            }
          : task
      ));
      setActiveTask(null);
      setShowReasonDialog(false);
      setCurrentTaskId(null);
      setIncompleteReason('');
      
      Alert.alert('Success', 'Task reported to Team Leader for rescheduling');
    }
  };

  const getCurrentTask = () => {
    return tasks.find(task => task.id === currentTaskId);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Parks & Gardens</Text>
          <Text style={styles.headerSubtitle}>Field Staff App</Text>
        </View>
        <View style={styles.headerUser}>
          <Text style={styles.userName}>John Smith</Text>
          <Text style={styles.userTeam}>Crew #2</Text>
        </View>
      </View>

      {/* Tasks List */}
      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Today's Tasks</Text>
        
        {tasks.map(task => (
          <View key={task.id} style={[
            styles.taskCard,
            { borderLeftColor: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981' }
          ]}>
            <View style={styles.taskHeader}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: 
                  task.status === 'completed' ? '#dcfce7' :
                  task.status === 'in-progress' ? '#dbeafe' :
                  task.status === 'needs-rescheduling' ? '#fed7aa' : '#f3f4f6'
                }
              ]}>
                <Text style={[
                  styles.statusText,
                  { color:
                    task.status === 'completed' ? '#166534' :
                    task.status === 'in-progress' ? '#1e40af' :
                    task.status === 'needs-rescheduling' ? '#ea580c' : '#374151'
                  }
                ]}>
                  {task.status === 'needs-rescheduling' ? 'needs rescheduling' : task.status.replace('-', ' ')}
                </Text>
              </View>
            </View>

            <Text style={styles.taskLocation}>📍 {task.location}</Text>
            <Text style={styles.taskDuration}>⏱️ Est. {Math.floor(task.estimatedHours)}h {Math.round((task.estimatedHours % 1) * 60)}m</Text>

            {/* Safety Documents Indicator */}
            <View style={styles.safetyDocsContainer}>
              <Text style={styles.safetyDocsTitle}>📋 Safety Documents:</Text>
              <Text style={styles.safetyDoc}>• RA: {task.riskAssessment.title}</Text>
              <Text style={styles.safetyDoc}>• SWMS: {task.swms.title}</Text>
            </View>

            {task.startTime && (
              <Text style={styles.timeInfo}>
                Started: {task.startTime}
                {task.endTime && ` • Ended: ${task.endTime}`}
                {task.incompleteReason && (
                  <Text style={styles.reasonText}>{'\n'}Reason: {task.incompleteReason}</Text>
                )}
              </Text>
            )}

            <View style={styles.buttonContainer}>
              {task.status === 'assigned' && (
                <TouchableOpacity
                  style={styles.startButton}
                  onPress={() => startTaskWithSafety(task.id)}
                >
                  <Text style={styles.buttonText}>▶️ Start Task</Text>
                </TouchableOpacity>
              )}

              {task.status === 'in-progress' && (
                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={() => stopTask(task.id)}
                >
                  <Text style={styles.buttonText}>⏹️ Stop Task</Text>
                </TouchableOpacity>
              )}

              {task.status === 'completed' && (
                <View style={styles.completedButton}>
                  <Text style={styles.completedText}>✅ Completed</Text>
                </View>
              )}

              {task.status === 'needs-rescheduling' && (
                <View style={styles.rescheduleButton}>
                  <Text style={styles.rescheduleText}>⏳ Awaiting Reschedule</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Safety Documents Dialog */}
      <Modal visible={showSafetyDialog} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.safetyModalContent}>
            <Text style={styles.safetyModalTitle}>⚠️ Safety Documentation Review</Text>
            <Text style={styles.safetyModalSubtitle}>You must read and acknowledge these documents before starting</Text>
            
            <ScrollView style={styles.safetyScrollView} showsVerticalScrollIndicator={true}>
              {getCurrentTask() && (
                <>
                  {/* Risk Assessment Section */}
                  <View style={styles.safetySection}>
                    <Text style={styles.sectionHeader}>🚨 RISK ASSESSMENT</Text>
                    <Text style={styles.documentTitle}>{getCurrentTask()?.riskAssessment.title}</Text>
                    
                    <Text style={styles.subSectionTitle}>Identified Hazards:</Text>
                    {getCurrentTask()?.riskAssessment.hazards.map((hazard, index) => (
                      <Text key={index} style={styles.bulletPoint}>• {hazard}</Text>
                    ))}
                    
                    <Text style={styles.subSectionTitle}>Control Measures:</Text>
                    {getCurrentTask()?.riskAssessment.controls.map((control, index) => (
                      <Text key={index} style={styles.bulletPoint}>• {control}</Text>
                    ))}
                  </View>

                  {/* SWMS Section */}
                  <View style={styles.safetySection}>
                    <Text style={styles.sectionHeader}>📋 SAFE WORK METHOD STATEMENT</Text>
                    <Text style={styles.documentTitle}>{getCurrentTask()?.swms.title}</Text>
                    
                    <Text style={styles.subSectionTitle}>Work Steps:</Text>
                    {getCurrentTask()?.swms.steps.map((step, index) => (
                      <Text key={index} style={styles.numberedPoint}>{index + 1}. {step}</Text>
                    ))}
                    
                    <Text style={styles.subSectionTitle}>Required PPE:</Text>
                    {getCurrentTask()?.swms.ppe.map((ppe, index) => (
                      <Text key={index} style={styles.bulletPoint}>• {ppe}</Text>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            {/* Acknowledgment Checkboxes */}
            <View style={styles.acknowledgeContainer}>
              <TouchableOpacity 
                style={styles.checkboxRow} 
                onPress={() => setRaAcknowledged(!raAcknowledged)}
              >
                <View style={[styles.checkbox, raAcknowledged && styles.checkboxChecked]}>
                  {raAcknowledged && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>I have read and understood the Risk Assessment</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.checkboxRow} 
                onPress={() => setSwmsAcknowledged(!swmsAcknowledged)}
              >
                <View style={[styles.checkbox, swmsAcknowledged && styles.checkboxChecked]}>
                  {swmsAcknowledged && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>I have read and understood the SWMS</Text>
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.safetyButtonRow}>
              <TouchableOpacity 
                style={styles.cancelSafetyButton} 
                onPress={() => {
                  setShowSafetyDialog(false);
                  setCurrentTaskId(null);
                  setRaAcknowledged(false);
                  setSwmsAcknowledged(false);
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.startSafetyButton, 
                  (!raAcknowledged || !swmsAcknowledged) && styles.disabledButton
                ]} 
                onPress={confirmSafetyAndStart}
                disabled={!raAcknowledged || !swmsAcknowledged}
              >
                <Text style={styles.buttonText}>Start Task Safely</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Task Complete Dialog */}
      <Modal visible={showCompleteDialog} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Is the task complete?</Text>
            <TouchableOpacity style={styles.completeButton} onPress={handleTaskComplete}>
              <Text style={styles.buttonText}>✅ Yes, Task Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.incompleteButton} onPress={handleTaskIncomplete}>
              <Text style={styles.buttonText}>❌ No, Need to Reschedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reason for Incomplete Dialog */}
      <Modal visible={showReasonDialog} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Why couldn't you complete the task?</Text>
            <TextInput
              style={styles.textInput}
              value={incompleteReason}
              onChangeText={setIncompleteReason}
              placeholder="e.g., Equipment malfunction, weather conditions..."
              multiline
              autoFocus
            />
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => {
                  setShowReasonDialog(false);
                  setIncompleteReason('');
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitButton, !incompleteReason.trim() && styles.disabledButton]} 
                onPress={submitIncompleteTask}
                disabled={!incompleteReason.trim()}
              >
                <Text style={styles.buttonText}>Send to Team Leader</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#059669',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#a7f3d0',
    fontSize: 12,
  },
  headerUser: {
    alignItems: 'flex-end',
  },
  userName: {
    color: 'white',
    fontSize: 14,
  },
  userTeam: {
    color: '#a7f3d0',
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#374151',
  },
  taskCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  taskLocation: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  taskDuration: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  safetyDocsContainer: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  safetyDocsTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 4,
  },
  safetyDoc: {
    fontSize: 10,
    color: '#92400e',
    marginBottom: 1,
  },
  timeInfo: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  reasonText: {
    color: '#ea580c',
  },
  buttonContainer: {
    marginTop: 8,
  },
  startButton: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  completedButton: {
    backgroundColor: '#dcfce7',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  completedText: {
    color: '#166534',
    fontWeight: '500',
  },
  rescheduleButton: {
    backgroundColor: '#fed7aa',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  rescheduleText: {
    color: '#ea580c',
    fontWeight: '500',
  },
  buttonText: {
    color: 'white',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  safetyModalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
    width: '95%',
    maxHeight: '90%',
  },
  safetyModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#dc2626',
  },
  safetyModalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    color: '#6b7280',
  },
  safetyScrollView: {
    maxHeight: 400,
    marginBottom: 16,
  },
  safetySection: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 8,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 8,
    marginBottom: 4,
  },
  bulletPoint: {
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 2,
    paddingLeft: 8,
  },
  numberedPoint: {
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 4,
    paddingLeft: 8,
  },
  acknowledgeContainer: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  safetyButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelSafetyButton: {
    flex: 1,
    backgroundColor: '#6b7280',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  startSafetyButton: {
    flex: 1,
    backgroundColor: '#059669',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  completeButton: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    alignItems: 'center',
  },
  incompleteButton: {
    backgroundColor: '#f59e0b',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6b7280',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default App;