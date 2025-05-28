const [swmsAcknowledged, setSwmsAcknowledged] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  const [tasks, setTasks] = useState([]);import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://parks-gardens-app-production.up.railway.app/api';

// API Helper Functions
const apiCall = async (endpoint: string, options: any = {}) => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(true);
  
  const [currentView, setCurrentView] = useState('schedule');
  const [activeTask, setActiveTask] = useState<number | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [showSafetyDialog, setShowSafetyDialog] = useState(false);
  const [incompleteReason, setIncompleteReason] = useState('');
  const [currentTaskId, setCurrentTaskId] = useState<number | null>(null);
  const [raAcknowledged, setRaAcknowledged] = useState(false);
  const [swmsAcknowledged, setSwmsAcknowledged] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  const [tasks, setTasks] = useState([]);

  // Check if user is logged in on app start
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Load today's tasks when logged in
  useEffect(() => {
    if (isLoggedIn) {
      loadTodaysTasks();
    }
  }, [isLoggedIn]);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const user = await AsyncStorage.getItem('currentUser');
      
      if (token && user) {
        setIsLoggedIn(true);
        setCurrentUser(JSON.parse(user));
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });

      await AsyncStorage.setItem('authToken', response.token);
      await AsyncStorage.setItem('currentUser', JSON.stringify(response.user));
      
      setCurrentUser(response.user);
      setIsLoggedIn(true);
      setLoginForm({ email: '', password: '' });
    } catch (error) {
      Alert.alert('Login Failed', 'Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('currentUser');
    setIsLoggedIn(false);
    setCurrentUser(null);
    setTasks([]);
  };

  const loadTodaysTasks = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await apiCall(`/my-tasks?date=${today}`);
      
      // Transform the database response to match our app format
      const transformedTasks = response.map((task: any) => ({
        id: task.id,
        title: task.title,
        location: task.location,
        estimatedHours: parseFloat(task.estimated_hours),
        priority: task.priority,
        status: task.status,
        equipment: task.equipment_required || [],
        startTime: task.start_time ? new Date(task.start_time).toLocaleTimeString() : null,
        endTime: task.end_time ? new Date(task.end_time).toLocaleTimeString() : null,
        incompleteReason: task.incomplete_reason,
        riskAssessment: task.risk_assessment_title ? {
          title: task.risk_assessment_title,
          hazards: task.hazards || [],
          controls: task.controls || []
        } : null,
        swms: task.swms_title ? {
          title: task.swms_title,
          steps: task.steps || [],
          ppe: task.ppe || []
        } : null
      }));
      
      setTasks(transformedTasks);
    } catch (error) {
      Alert.alert('Error', 'Failed to load tasks. Please try again.');
      console.error('Load tasks failed:', error);
    }
  };

  const updateTaskStatus = async (taskId: number, status: string, extraData: any = {}) => {
    try {
      await apiCall(`/tasks/${taskId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          ...extraData
        }),
      });
      
      // Reload tasks to get updated data
      await loadTodaysTasks();
    } catch (error) {
      Alert.alert('Error', 'Failed to update task status. Please try again.');
      console.error('Update task failed:', error);
    }
  };

  const startTaskWithSafety = (taskId: number) => {
    setCurrentTaskId(taskId);
    setRaAcknowledged(false);
    setSwmsAcknowledged(false);
    setShowSafetyDialog(true);
  };

  const confirmSafetyAndStart = async () => {
    if (raAcknowledged && swmsAcknowledged && currentTaskId) {
      await updateTaskStatus(currentTaskId, 'in-progress', {
        start_time: new Date().toISOString()
      });
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

  const handleTaskComplete = async () => {
    if (currentTaskId) {
      await updateTaskStatus(currentTaskId, 'completed', {
        end_time: new Date().toISOString()
      });
      setActiveTask(null);
      setShowCompleteDialog(false);
      setCurrentTaskId(null);
    }
  };

  const handleTaskIncomplete = () => {
    setShowCompleteDialog(false);
    setShowReasonDialog(true);
  };

  const submitIncompleteTask = async () => {
    if (incompleteReason.trim() && currentTaskId) {
      await updateTaskStatus(currentTaskId, 'needs-rescheduling', {
        end_time: new Date().toISOString(),
        incomplete_reason: incompleteReason
      });
      
      setActiveTask(null);
      setShowReasonDialog(false);
      setCurrentTaskId(null);
      setIncompleteReason('');
      
      Alert.alert('Success', 'Task reported to Team Leader for rescheduling');
    }
  };

  const getCurrentTask = () => {
    return tasks.find((task: any) => task.id === currentTaskId);
  };

  // Show loading screen
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.headerTitle}>Parks & Gardens</Text>
        <Text style={styles.headerSubtitle}>Loading...</Text>
      </View>
    );
  }

  // Show login screen if not logged in
  if (!isLoggedIn) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Parks & Gardens</Text>
          <Text style={styles.headerSubtitle}>Field Staff Login</Text>
        </View>
        
        <View style={styles.loginContainer}>
          <Text style={styles.loginTitle}>Welcome Back</Text>
          
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={loginForm.email}
              onChangeText={(text) => setLoginForm({...loginForm, email: text})}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={loginForm.password}
              onChangeText={(text) => setLoginForm({...loginForm, password: text})}
              secureTextEntry
            />
            
            <TouchableOpacity style={styles.loginButton} onPress={login}>
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.demoCredentials}>
            <Text style={styles.demoTitle}>Demo Credentials:</Text>
            <Text style={styles.demoText}>Email: john.smith@cityparks.gov</Text>
            <Text style={styles.demoText}>Password: password</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Parks & Gardens</Text>
          <Text style={styles.headerSubtitle}>Field Staff App</Text>
        </View>
        <View style={styles.headerUser}>
          <TouchableOpacity onPress={() => setShowSidebar(true)}>
            <Text style={styles.userName}>{currentUser?.name}</Text>
            <Text style={styles.userTeam}>{currentUser?.crew_id}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tasks List */}
      <ScrollView style={styles.content}>
        <View style={styles.refreshContainer}>
          <TouchableOpacity onPress={loadTodaysTasks} style={styles.refreshButton}>
            <Text style={styles.refreshText}>🔄 Refresh Tasks</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.sectionTitle}>Today's Tasks ({tasks.length})</Text>
        
        {tasks.length === 0 ? (
          <View style={styles.noTasksContainer}>
            <Text style={styles.noTasksText}>No tasks assigned for today</Text>
          </View>
        ) : (
          tasks.map((task: any) => (
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
              {(task.riskAssessment || task.swms) && (
                <View style={styles.safetyDocsContainer}>
                  <Text style={styles.safetyDocsTitle}>📋 Safety Documents:</Text>
                  {task.riskAssessment && <Text style={styles.safetyDoc}>• RA: {task.riskAssessment.title}</Text>}
                  {task.swms && <Text style={styles.safetyDoc}>• SWMS: {task.swms.title}</Text>}
                </View>
              )}

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
          ))
        )}
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
                  {getCurrentTask()?.riskAssessment && (
                    <View style={styles.safetySection}>
                      <Text style={styles.sectionHeader}>🚨 RISK ASSESSMENT</Text>
                      <Text style={styles.documentTitle}>{getCurrentTask()?.riskAssessment.title}</Text>
                      
                      <Text style={styles.subSectionTitle}>Identified Hazards:</Text>
                      {getCurrentTask()?.riskAssessment.hazards.map((hazard: string, index: number) => (
                        <Text key={index} style={styles.bulletPoint}>• {hazard}</Text>
                      ))}
                      
                      <Text style={styles.subSectionTitle}>Control Measures:</Text>
                      {getCurrentTask()?.riskAssessment.controls.map((control: string, index: number) => (
                        <Text key={index} style={styles.bulletPoint}>• {control}</Text>
                      ))}
                    </View>
                  )}

                  {/* SWMS Section */}
                  {getCurrentTask()?.swms && (
                    <View style={styles.safetySection}>
                      <Text style={styles.sectionHeader}>📋 SAFE WORK METHOD STATEMENT</Text>
                      <Text style={styles.documentTitle}>{getCurrentTask()?.swms.title}</Text>
                      
                      <Text style={styles.subSectionTitle}>Work Steps:</Text>
                      {getCurrentTask()?.swms.steps.map((step: string, index: number) => (
                        <Text key={index} style={styles.numberedPoint}>{index + 1}. {step}</Text>
                      ))}
                      
                      <Text style={styles.subSectionTitle}>Required PPE:</Text>
                      {getCurrentTask()?.swms.ppe.map((ppe: string, index: number) => (
                        <Text key={index} style={styles.bulletPoint}>• {ppe}</Text>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Acknowledgment Checkboxes */}
            <View style={styles.acknowledgeContainer}>
              {getCurrentTask()?.riskAssessment && (
                <TouchableOpacity 
                  style={styles.checkboxRow} 
                  onPress={() => setRaAcknowledged(!raAcknowledged)}
                >
                  <View style={[styles.checkbox, raAcknowledged && styles.checkboxChecked]}>
                    {raAcknowledged && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>I have read and understood the Risk Assessment</Text>
                </TouchableOpacity>
              )}

              {getCurrentTask()?.swms && (
                <TouchableOpacity 
                  style={styles.checkboxRow} 
                  onPress={() => setSwmsAcknowledged(!swmsAcknowledged)}
                >
                  <View style={[styles.checkbox, swmsAcknowledged && styles.checkboxChecked]}>
                    {swmsAcknowledged && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>I have read and understood the SWMS</Text>
                </TouchableOpacity>
              )}
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
                  ((!getCurrentTask()?.riskAssessment || raAcknowledged) && (!getCurrentTask()?.swms || swmsAcknowledged)) ? {} : styles.disabledButton
                ]} 
                onPress={confirmSafetyAndStart}
                disabled={!((getCurrentTask()?.riskAssessment ? raAcknowledged : true) && (getCurrentTask()?.swms ? swmsAcknowledged : true))}
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

      {/* User Sidebar */}
      <Modal visible={showSidebar} transparent animationType="slide">
        <View style={styles.sidebarOverlay}>
          <TouchableOpacity 
            style={styles.sidebarBackdrop} 
            onPress={() => setShowSidebar(false)}
          />
          <View style={styles.sidebarContent}>
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>User Menu</Text>
              <TouchableOpacity onPress={() => setShowSidebar(false)}>
                <Text style={styles.sidebarClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.sidebarProfile}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileInitials}>
                  {currentUser?.name?.split(' ').map((n: string) => n[0]).join('')}
                </Text>
              </View>
              <Text style={styles.profileName}>{currentUser?.name}</Text>
              <Text style={styles.profileTeam}>{currentUser?.crew_id}</Text>
              <Text style={styles.profileEmail}>{currentUser?.email}</Text>
            </View>

            <View style={styles.sidebarMenu}>
              <TouchableOpacity style={styles.menuItem} onPress={loadTodaysTasks}>
                <Text style={styles.menuIcon}>🔄</Text>
                <Text style={styles.menuText}>Refresh Tasks</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.menuItem}>
                <Text style={styles.menuIcon}>📋</Text>
                <Text style={styles.menuText}>View All Tasks</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.menuItem}>
                <Text style={styles.menuIcon}>⚠️</Text>
                <Text style={styles.menuText}>Safety Documents</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.menuItem}>
                <Text style={styles.menuIcon}>📞</Text>
                <Text style={styles.menuText}>Emergency Contact</Text>
              </TouchableOpacity>
              
              <View style={styles.menuDivider} />
              
              <TouchableOpacity 
                style={[styles.menuItem, styles.logoutMenuItem]} 
                onPress={() => {
                  setShowSidebar(false);
                  logout();
                }}
              >
                <Text style={styles.menuIcon}>🚪</Text>
                <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
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
  loginContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#374151',
  },
  form: {
    marginBottom: 30,
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#059669',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  demoCredentials: {
    backgroundColor: '#f3f4f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  demoTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#374151',
  },
  demoText: {
    color: '#6b7280',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  refreshContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  refreshText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#374151',
  },
  noTasksContainer: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  noTasksText: {
    color: '#6b7280',
    fontSize: 16,
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
  // Sidebar Styles
  sidebarOverlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sidebarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sidebarContent: {
    width: 300,
    backgroundColor: 'white',
    height: '100%',
    paddingTop: 50,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
  },
  sidebarClose: {
    fontSize: 20,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  sidebarProfile: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileInitials: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
  },
  profileTeam: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 12,
    color: '#6b7280',
  },
  sidebarMenu: {
    flex: 1,
    padding: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 5,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 15,
    width: 25,
  },
  menuText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 15,
  },
  logoutMenuItem: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutText: {
    color: '#dc2626',
  },
});

export default App;