import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import { mqttService } from '../services/mqttService';

// Global error handling for uncaught promise errors
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
});

const MainPage = () => {
  const { line } = useParams();
  const [operators, setOperators] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const webcamRef = useRef(null);

  useEffect(() => {
    const loadModelsAndData = async () => {
      try {
        await faceapi.tf.setBackend('webgl');
        await faceapi.tf.ready();
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        setModelsLoaded(true);

        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        const [operatorsRes, attendanceRes] = await Promise.all([
          axios.get(`https://backend.yourcat.tech/api/operators/${line}`, { headers }),
          axios.get(`https://backend.yourcat.tech/api/attendance/${line}/${new Date().toISOString().split('T')[0]}`, { headers }),
        ]);

        setOperators(operatorsRes.data || []);
        setAttendance(Array.isArray(attendanceRes.data) ? attendanceRes.data : []);
      } catch (error) {
        console.error('Error loading models or data:', error);
        if (error.response) {
          setError(`Server error: ${error.response.status} - ${error.response.data.message || 'Unknown error'}`);
        } else if (error.request) {
          setError('Cannot connect to the server. Please check if it’s running.');
        } else {
          setError('An unexpected error occurred while loading data.');
        }
      }
    };
    loadModelsAndData();
  }, [line]);

  const today = new Date().toISOString().split('T')[0];

  const UpdateOperatorsModal = ({ onClose }) => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', employeeId: '', station: '', ledIndex: '', file: null });
    const [preview, setPreview] = useState(null);

    // Handle file selection and preview
    const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file) {
        setFormData({ ...formData, file });
        // Generate a preview URL for the image
        const previewUrl = URL.createObjectURL(file);
        setPreview(previewUrl);
      }
    }; 

    const handleAddOperator = async (e) => {
      e.preventDefault();
      if (!formData.file || !formData.name || !formData.employeeId || !formData.station || formData.ledIndex === '') {
        alert('Please fill all fields, including LED Index, and upload an image.');
        return;
      }

      const ledIndex = parseInt(formData.ledIndex, 10);
      if (isNaN(ledIndex) || ledIndex < 0 || ledIndex > 20) {
        alert('LED Index must be a number between 0 and 20.');
        return;
      }

      try {
        // Create a unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const fileExtension = formData.file.name.split('.').pop();
        const fileName = `operator-${uniqueSuffix}.${fileExtension}`;
        const imagePath = `/images/${fileName}`; // Path relative to public folder

        // Note: In a browser, you cannot directly save to public/images.
        // For development, manually place the file in frontend/public/images or use a dev server.
        // For deployment, images must be committed to GitHub and served by Vercel.

        // Optionally, upload to a local dev server (if set up)
        let finalImagePath = imagePath;
        if (process.env.NODE_ENV !== 'production') {
          const formDataToSend = new FormData();
          formDataToSend.append('file', formData.file);
          const uploadRes = await axios.post('https://backend.yourcat.tech/upload', formDataToSend, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          finalImagePath = uploadRes.data.imagePath;
        }

        // Send operator data to backend
        const operatorData = {
          name: formData.name,
          employeeId: formData.employeeId,
          station: formData.station,
          imagePath: finalImagePath,
          ledIndex: ledIndex,
        };

        const res = await axios.post(
          `https://backend.yourcat.tech/api/operators/${line}`,
          operatorData,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json',
            },
          }
        );

        setOperators([...operators, res.data]);
        setShowAddForm(false);
        setFormData({ name: '', employeeId: '', station: '', ledIndex: '', file: null });
        setPreview(null);
        alert('Operator added successfully.');
      } catch (error) {
        console.error('Error adding operator:', error);
        const errorMessage = error.response?.data?.message || error.message;
        alert(`Error adding operator: ${errorMessage}`);
      }
    };

    const handleDeleteOperator = async (id) => {
      try {
        await axios.delete(`https://backend.yourcat.tech/api/operators/${line}/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setOperators(operators.filter((op) => op._id !== id));
      } catch (error) {
        console.error('Error deleting operator:', error);
        alert(`Error deleting operator: ${error.response?.data?.message || error.message}`);
      }
    };

    // Helper to get available LED indexes (0-16)
    const getAvailableLedIndexes = () => {
      const assigned = operators.map(op => op.ledIndex);
      const allIndexes = Array.from({ length: 21 }, (_, i) => i);
      return allIndexes.filter(idx => !assigned.includes(idx));
    };

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white p-6 rounded shadow-lg w-3/4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold mb-4">Update Operators</h2>
          <button onClick={() => setShowAddForm(true)} className="bg-green-500 text-white px-4 py-2 rounded mb-4">
            Add New Operator
          </button>
          <table className="min-w-full bg-white border">
            <thead>
              <tr>
                <th className="py-2 px-4 border">Name</th>
                <th className="py-2 px-4 border">Employee ID</th>
                <th className="py-2 px-4 border">Station</th>
                <th className="py-2 px-4 border">LED Index</th>
                <th className="py-2 px-4 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((op) => (
                <tr key={op._id} className="border-t">
                  <td className="py-2 px-4">{op.name}</td>
                  <td className="py-2 px-4">{op.employeeId}</td>
                  <td className="py-2 px-4">{op.station}</td>
                  <td className="py-2 px-4">{op.ledIndex}</td>
                  <td className="py-2 px-4">
                    <button onClick={() => handleDeleteOperator(op._id)} className="text-red-500 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {showAddForm && (
            <div className="mt-4">
              <form onSubmit={handleAddOperator}>
                <input
                  type="text"
                  placeholder="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="border p-2 mb-2 w-full"
                />
                <input
                  type="text"
                  placeholder="Employee ID"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="border p-2 mb-2 w-full"
                />
                <select
                  value={formData.station}
                  onChange={(e) => setFormData({ ...formData, station: e.target.value })}
                  className="border p-2 mb-2 w-full"
                  required
                >
                  <option value="">Select Station</option>
                  <option value="Station 1">Main Board VI</option>
                  <option value="Station 2">Sub board VI</option>
                  <option value="Station 3">LDA Inspection</option>
                  <option value="Station 4">Front camera copper foil paste</option>
                  <option value="Station 5">Front camera installation</option>
                  <option value="Station 6">Rear camera installation</option>
                  <option value="Station 7">IDLE</option>
                  <option value="Station 8">Middle Frame Installation (1)</option>
                  <option value="Station 9">Middle Frame Installation (2)</option>
                  <option value="Station 10">Key Part 3 (1)</option>
                  <option value="Station 11">Key Part 3 (2)</option>
                  <option value="Station 12">YH2</option>
                  <option value="Station 13">Middle Frame Inspection</option>
                  <option value="Station 14">Battery cover Pressing (1)</option>
                  <option value="Station 15">Battery cover Pressing (2)</option>
                  <option value="Station 16">Battery cover VI (1)</option>
                  <option value="Station 17">Battery cover VI (2)</option>
                  <option value="Station 18">Vibrator installation</option>
                  <option value="Station 19">Speaker installation</option>
                  <option value="Station 20">Receiver installation</option>
                </select>
                <select
                  value={formData.ledIndex}
                  onChange={(e) => setFormData({ ...formData, ledIndex: e.target.value })}
                  className="border p-2 mb-2 w-full"
                  required
                >
                  <option value="">Select LED Index</option>
                  {getAvailableLedIndexes().map(idx => (
                    <option key={idx} value={idx}>{idx}</option>
                  ))}
                </select>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="border p-2 mb-2 w-full"
                />
                {preview && (
                  <img src={preview} alt="Preview" className="w-32 h-32 object-cover mb-2" />
                )}
                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
                  Add Operator
                </button>
              </form>
            </div>
          )}
          <button onClick={onClose} className="mt-4 text-blue-500 hover:underline">Close</button>
        </div>
      </div>
    );
  };

  const MarkAttendanceModal = ({ onClose }) => {
    const [selectedStation, setSelectedStation] = useState('');
    const [labeledDescriptors, setLabeledDescriptors] = useState([]);
    const [isRecognizing, setIsRecognizing] = useState(false);
    const stations = [...new Set(operators.map((op) => op.station))];

    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (webcamRef.current) {
          webcamRef.current.video.srcObject = stream;
          webcamRef.current.video.onloadedmetadata = () => {
            console.log('Video metadata loaded:', {
              width: webcamRef.current.video.videoWidth,
              height: webcamRef.current.video.videoHeight,
            });
          };
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setIsRecognizing(false);
        alert('Failed to access webcam. Please ensure camera access is granted.');
      }
    };

    useEffect(() => {
      if (!selectedStation || !modelsLoaded) return;

      const loadDescriptors = async () => {
        const stationOperators = operators.filter((op) => op.station === selectedStation);
        if (stationOperators.length === 0) {
          setLabeledDescriptors([]);
          return;
        }

        const descriptors = await Promise.all(
          stationOperators.map(async (op) => {
            try {
              // Use the frontend's base URL for deployed images
              const baseUrl = process.env.REACT_APP_FRONTEND_URL || '';
              const imageUrl = `${baseUrl}${op.imagePath}`;
              console.log(`Fetching image for operator ${op.name}: ${imageUrl}`);
              const img = await faceapi.fetchImage(imageUrl);
              const detection = await faceapi
                .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();
              if (!detection) {
                console.warn(`No face detected in image for operator ${op.name}`);
                return null;
              }
              return new faceapi.LabeledFaceDescriptors(op._id, [detection.descriptor]);
            } catch (error) {
              console.error(`Error loading image for operator ${op.name}:`, error);
              return null;
            }
          })
        );
        const validDescriptors = descriptors.filter((d) => d !== null);
        setLabeledDescriptors(validDescriptors);
        if (validDescriptors.length === 0) {
          alert('No valid face descriptors found for operators in this station.');
        }
      };

      loadDescriptors();
    }, [selectedStation, modelsLoaded]);

    const recognizeFace = async () => {
      if (!webcamRef.current || webcamRef.current.video.readyState !== 4) {
        alert('Webcam is not ready. Please ensure camera access is granted.');
        setIsRecognizing(false);
        return;
      }
      if (labeledDescriptors.length === 0) {
        alert('No operators with valid face data for this station.');
        setIsRecognizing(false);
        return;
      }

      const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors);
      console.log('Face matcher initialized with', labeledDescriptors.length, 'known faces');

      const startTime = Date.now();
      try {
        const detection = await faceapi
          .detectSingleFace(webcamRef.current.video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const currentTimestamp = new Date().toISOString();

        if (!detection) {
          alert('No face detected in webcam feed.');
          await axios.post(
            `https://backend.yourcat.tech/api/attendance/${line}/fail`,
            { station: selectedStation, timestamp: currentTimestamp },
            { headers }
          );
          setIsRecognizing(false);
          return;
        }

        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
        const endTime = Date.now();
        console.log(`Recognition time: ${(endTime - startTime) / 1000} seconds`);

        if (bestMatch.label !== 'unknown' && bestMatch.distance < 0.6) {
          const matchedOperator = operators.find((op) => op._id === bestMatch.label);
          if (matchedOperator) {
            const attendanceRecord = {
              operatorId: matchedOperator._id,
              date: today,
              timestamp: currentTimestamp,
            };
            console.log('Sending attendance record:', attendanceRecord);
            try {
              const response = await axios.post(
                `https://backend.yourcat.tech/api/attendance/${line}`,
                attendanceRecord,
                { headers }
              );
              setAttendance([...attendance, response.data]);
              alert(`Attendance marked successfully for ${matchedOperator.name} (distance: ${bestMatch.distance.toFixed(3)})`);
            } catch (error) {
              console.error('Error marking attendance:', error);
              alert('Error marking attendance. Please try again.');
            }
          } else {
            alert('Matched operator not found.');
          }
        } else {
          alert('No suitable operator found for the detected face (no match >= 60%).');
          await axios.post(
            `https://backend.yourcat.tech/api/attendance/${line}/fail`,
            { station: selectedStation, timestamp: currentTimestamp },
            { headers }
          );
        }
      } catch (error) {
        console.error('Error during face recognition:', error);
        alert('An error occurred during face recognition.');
      } finally {
        setIsRecognizing(false);
        if (webcamRef.current && webcamRef.current.video.srcObject) {
          webcamRef.current.video.srcObject.getTracks().forEach((track) => track.stop());
        }
      }
    };

    useEffect(() => {
      if (showMarkModal) {
        startVideo();
      }
      return () => {
        if (webcamRef.current && webcamRef.current.video.srcObject) {
          webcamRef.current.video.srcObject.getTracks().forEach((track) => track.stop());
        }
      };
    }, [showMarkModal]);

    const handleMarkAttendance = async () => {
      setIsRecognizing(true);
      try {
        await recognizeFace();

        // After successful attendance marking
        mqttService.publishAttendanceChange({
          operatorName: formattedAttendance.operatorName,
          employeeId: formattedAttendance.employeeId,
          station: formattedAttendance.station,
          status: formattedAttendance.status,
          timestamp: formattedAttendance.timestamp
        });

      } catch (error) {
        console.error('Error marking attendance:', error);
        alert('Error marking attendance');
      } finally {
        setIsRecognizing(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white p-6 rounded shadow-lg w-3/4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold mb-4">Mark Attendance</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Station:</label>
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="border p-2 rounded w-full"
            >
              <option value="">-- Select Station --</option>
              {stations.map((station, idx) => (
                <option key={idx} value={station}>{station}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="w-full h-auto rounded"
              videoConstraints={{ width: 640, height: 480 }}
            />
          </div>
          <button
            onClick={handleMarkAttendance}
            disabled={isRecognizing || !selectedStation}
            className={`bg-blue-500 text-white px-4 py-2 rounded mb-4 ${isRecognizing || !selectedStation ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isRecognizing ? 'Recognizing...' : 'Mark Attendance'}
          </button>
          <button onClick={onClose} className="mt-4 text-blue-500 hover:underline">Close</button>
        </div>
      </div>
    );
  };

  const ExportAttendanceModal = ({ onClose }) => {
    const [exportDate, setExportDate] = useState(today);

    const handleExport = async () => {
      try {
        const response = await axios.get(`https://backend.yourcat.tech/api/attendance/${line}/${exportDate}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${line}_${exportDate}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        alert('Export successful!');
      } catch (error) {
        console.error('Error exporting attendance:', error);
        alert('Error exporting attendance. Please try again.');
      }
    };

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white p-6 rounded shadow-lg w-3/4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold mb-4">Export Attendance</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Date:</label>
            <input
              type="date"
              value={exportDate}
              onChange={(e) => setExportDate(e.target.value)}
              className="border p-2 rounded w-full"
            />
          </div>
          <button onClick={handleExport} className="bg-blue-500 text-white px-4 py-2 rounded mb-4">
            Export Attendance
          </button>
          <button onClick={onClose} className="mt-4 text-blue-500 hover:underline">Close</button>
        </div>
      </div>
    );
  };

  const ViewOperatorsModal = ({ onClose }) => {
    const [selectedOperator, setSelectedOperator] = useState(null);
    const [showErrors, setShowErrors] = useState(false);

    // Define station-specific errors
    const stationErrors = {
      'Receiver installation': [
        "RAUD^Receiver_FR_200.000Hz",
        "RAUD^Receiver_RB_200.000Hz",
        "RAUD^Receiver_THD_200.000Hz",
        "RAUD^HSMIC2REC_LoopBack_Sampling"
      ],
      'Middle Frame Installation (1)': [
        "ANT^NR5G_N78_636666_DBM_RSSI",
        "GSM1800_698_DBM_Power_29",
        "WCDMA_B8_2788_DBM_Power_24",
        "ANT^LTE_B1_18300_DBM_RSSI",
        "ANT^WCDMA_B8_2788",
        "ANT^WCDMA_B5_4183_DBM_",
        "ANT^NR5G_N3_349500",
        "ANT^GSM1800_698_DBM_Power",
        "ANT^GPS_FreqDrift_1"
      ],
      'Middle Frame Installation (2)': [
        "ANT^NR5G_N78_636666_DBM_RSSI",
        "GSM1800_698_DBM_Power_29",
        "WCDMA_B8_2788_DBM_Power_24",
        "ANT^LTE_B1_18300_DBM_RSSI",
        "ANT^WCDMA_B8_2788",
        "ANT^WCDMA_B5_4183_DBM_",
        "ANT^NR5G_N3_349500",
        "ANT^GSM1800_698_DBM_Power",
        "ANT^GPS_FreqDrift_1"
      ],
      'Front camera installation': [
        "CAM1^Front8MBlemish_MuraCount",
        "CAM1^CatFront8MSFR37"
      ],
      'Rear camera installation': [
        "CAM1^CatRearWideSFRFar50Result",
        "CAM1^RearMainBlemish50_MuraCount",
        "CAM1^RearMainBlemish50_BlemishCount"
      ]
    };

    const handleOperatorClick = (operator) => {
      setSelectedOperator(operator);
      setShowErrors(false);
    };

    const handleBack = () => {
      setSelectedOperator(null);
      setShowErrors(false);
    };

    const toggleErrorsView = () => {
      setShowErrors(!showErrors);
    };

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white p-6 rounded shadow-lg w-3/4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          {selectedOperator ? (
            <div>
              <button 
                onClick={handleBack}
                className="mb-4 text-blue-500 hover:underline flex items-center"
              >
                ← Back to list
              </button>
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="w-full md:w-1/3">
                  <img 
                    src={`https://backend.yourcat.tech${selectedOperator.imagePath}`}
                    alt={`${selectedOperator.name}'s photo`}
                    className="w-full rounded-lg shadow-lg"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIGZpbGw9IiNFNUU3RUIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzZCNzI4MCIgZm9udC1mYW1pbHk9InN5c3RlbS11aSwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNnB4Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                    }}
                  />
                  <button
                    onClick={toggleErrorsView}
                    className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 w-full"
                  >
                    {showErrors ? 'Hide Errors' : 'View Errors'}
                  </button>
                </div>
                <div className="w-full md:w-2/3">
                  <h2 className="text-2xl font-bold mb-4">{selectedOperator.name}</h2>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-sm text-gray-600">Employee ID</p>
                        <p className="font-semibold">{selectedOperator.employeeId}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-sm text-gray-600">Station</p>
                        <p className="font-semibold">{selectedOperator.station}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-sm text-gray-600">LED Index</p>
                        <p className="font-semibold">{selectedOperator.ledIndex}</p>
                      </div>
                    </div>

                    {showErrors && (
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-3">Possible Errors</h3>
                        <table className="min-w-full border">
                          <thead>
                            <tr>
                              <th className="py-2 px-4 border bg-gray-50">Error</th>
                              <th className="py-2 px-4 border bg-gray-50">Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(stationErrors[selectedOperator.station] || []).map((error, index) => (
                              <tr key={index}>
                                <td className="py-2 px-4 border">{error}</td>
                                <td className="py-2 px-4 border text-center">0</td>
                              </tr>
                            ))}
                            {!stationErrors[selectedOperator.station] && (
                              <tr>
                                <td colSpan="2" className="py-2 px-4 border text-center text-gray-500">
                                  No specific errors defined for this station
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // List view of all operators
            <>
              <h2 className="text-xl font-bold mb-4">Operators List</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {operators.map((op) => (
                  <div 
                    key={op._id} 
                    className="border rounded-lg p-4 flex flex-col items-center cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleOperatorClick(op)}
                  >
                    <div className="w-32 h-32 mb-3 relative">
                      <img 
                        src={`https://backend.yourcat.tech${op.imagePath}`}
                        alt={`${op.name}'s photo`}
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIGZpbGw9IiNFNUU3RUIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzZCNzI4MCIgZm9udC1mYW1pbHk9InN5c3RlbS11aSwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNnB4Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                        }}
                      />
                    </div>
                    <h3 className="text-lg font-semibold mb-1 hover:text-blue-500">{op.name}</h3>
                    <p className="text-gray-600">{op.station}</p>
                  </div>
                ))}
              </div>
            </>
          )}
          <button 
            onClick={onClose} 
            className="mt-6 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  const displayDateTime = (timestamp) => {
    if (!timestamp) {
      console.warn('Timestamp is missing or undefined:', timestamp);
      return { date: 'N/A', time: 'N/A' };
    }
    const dateObj = new Date(timestamp);
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid timestamp received:', timestamp);
      return { date: 'Invalid Date', time: 'Invalid Time' };
    }
    return {
      date: dateObj.toLocaleDateString('en-US', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
      time: dateObj.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    };
  };

  useEffect(() => {
    mqttService.connect();
    return () => mqttService.disconnect();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Attendance System - Line {line}</h1>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <button 
          onClick={() => setShowViewModal(true)} 
          className="bg-purple-500 text-white px-4 py-2 rounded"
        >
          View Operators
        </button>
        <button 
          onClick={() => setShowUpdateModal(true)} 
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Update Operators
        </button>
        <button 
          onClick={() => setShowMarkModal(true)} 
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Mark Attendance
        </button>
        <button 
          onClick={() => setShowExportModal(true)} 
          className="bg-yellow-500 text-white px-4 py-2 rounded"
        >
          Export Attendance
        </button>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Today's Attendance</h2>
        <table className="min-w-full bg-white border">
          <thead>
            <tr>
              <th className="py-2 px-4 border">Operator Name</th>
              <th className="py-2 px-4 border">Employee ID</th>
              <th className="py-2 px-4 border">Station</th>
              <th className="py-2 px-4 border">Date</th>
              <th className="py-2 px-4 border">Time</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-2 px-4 text-center">No attendance records found for today.</td>
              </tr>
            ) : (
              attendance.map((record) => {
                console.log('Attendance record in table:', record);
                const { date, time } = displayDateTime(record.timestamp);
                return (
                  <tr key={record._id} className="border-t">
                    <td className="py-2 px-4">{record.operatorName}</td>
                    <td className="py-2 px-4">{record.employeeId}</td>
                    <td className="py-2 px-4">{record.station}</td>
                    <td className="py-2 px-4">{date}</td>
                    <td className="py-2 px-4">{time}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {showUpdateModal && <UpdateOperatorsModal onClose={() => setShowUpdateModal(false)} />}
      {showMarkModal && <MarkAttendanceModal onClose={() => setShowMarkModal(false)} />}
      {showExportModal && <ExportAttendanceModal onClose={() => setShowExportModal(false)} />}
      {showViewModal && <ViewOperatorsModal onClose={() => setShowViewModal(false)} />}
    </div>
  );
};

export default MainPage;