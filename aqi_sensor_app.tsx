import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle, Thermometer, Droplets, Wind, Settings } from 'lucide-react';

export default function AQISensorApp() {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [ipAddress, setIpAddress] = useState('');
  const [inputIp, setInputIp] = useState('192.168.4.1');
  const [isConfigured, setIsConfigured] = useState(false);

  // Fuzzy logic membership functions
  const fuzzyLogic = {
    // AQI Deviation membership (from baseline 200)
    aqiMembership: (deviation) => {
      const absDeviation = Math.abs(deviation);
      return {
        excellent: Math.max(0, 1 - absDeviation / 20),
        good: absDeviation < 20 ? Math.max(0, absDeviation / 20) : Math.max(0, 1 - (absDeviation - 20) / 30),
        moderate: absDeviation >= 30 && absDeviation < 80 ? Math.min(1, (absDeviation - 30) / 30) : Math.max(0, 1 - Math.abs(absDeviation - 65) / 35),
        poor: absDeviation >= 70 && absDeviation < 150 ? Math.min(1, (absDeviation - 70) / 50) : Math.max(0, 1 - Math.abs(absDeviation - 120) / 50),
        hazardous: Math.min(1, Math.max(0, (absDeviation - 130) / 70))
      };
    },
    
    // Temperature membership (Celsius)
    tempMembership: (temp) => {
      return {
        cold: Math.max(0, 1 - (temp - 10) / 10),
        comfortable: temp >= 18 && temp <= 26 ? 1 : temp < 18 ? Math.max(0, (temp - 10) / 8) : Math.max(0, 1 - (temp - 26) / 8),
        warm: temp >= 24 && temp <= 32 ? Math.min(1, (temp - 24) / 4) : Math.max(0, 1 - Math.abs(temp - 28) / 8),
        hot: Math.min(1, Math.max(0, (temp - 30) / 10))
      };
    },
    
    // Humidity membership (%)
    humidityMembership: (humidity) => {
      return {
        dry: Math.max(0, 1 - humidity / 30),
        comfortable: humidity >= 30 && humidity <= 60 ? 1 : humidity < 30 ? Math.max(0, humidity / 30) : Math.max(0, 1 - (humidity - 60) / 20),
        humid: humidity >= 50 && humidity <= 80 ? Math.min(1, (humidity - 50) / 15) : Math.max(0, 1 - Math.abs(humidity - 65) / 25),
        veryHumid: Math.min(1, Math.max(0, (humidity - 70) / 20))
      };
    }
  };

  // Defuzzification to get final condition
  const getEnvironmentCondition = (mq135Raw, baseline, temp, humidity) => {
    const deviation = mq135Raw - baseline;
    
    const aqiScores = fuzzyLogic.aqiMembership(deviation);
    const tempScores = fuzzyLogic.tempMembership(temp);
    const humidityScores = fuzzyLogic.humidityMembership(humidity);
    
    // Rule-based inference with weighted aggregation
    const conditions = {
      excellent: Math.min(aqiScores.excellent, tempScores.comfortable, humidityScores.comfortable),
      good: Math.max(
        Math.min(aqiScores.good, tempScores.comfortable),
        Math.min(aqiScores.excellent, Math.max(tempScores.warm, humidityScores.humid))
      ),
      suitable: Math.max(
        Math.min(aqiScores.moderate, tempScores.comfortable),
        Math.min(aqiScores.good, Math.max(tempScores.warm, tempScores.cold))
      ),
      moderate: Math.max(
        aqiScores.moderate,
        Math.min(aqiScores.good, Math.max(humidityScores.humid, humidityScores.dry)),
        Math.min(tempScores.hot, humidityScores.veryHumid)
      ),
      poor: Math.max(
        aqiScores.poor,
        Math.min(aqiScores.moderate, Math.max(tempScores.hot, humidityScores.veryHumid))
      ),
      hazardous: Math.max(
        aqiScores.hazardous,
        Math.min(aqiScores.poor, tempScores.hot, humidityScores.veryHumid)
      )
    };
    
    // Find max membership
    const maxCondition = Object.entries(conditions).reduce((max, [key, value]) => 
      value > max.value ? { condition: key, value } : max, 
      { condition: 'moderate', value: 0 }
    );
    
    return maxCondition.condition;
  };

  const getConditionDetails = (condition) => {
    const details = {
      excellent: { 
        label: 'Excellent', 
        color: 'from-green-500 to-emerald-500',
        textColor: 'text-green-600',
        bgColor: 'bg-green-50',
        message: 'Perfect air quality and climate conditions'
      },
      good: { 
        label: 'Good', 
        color: 'from-blue-500 to-cyan-500',
        textColor: 'text-blue-600',
        bgColor: 'bg-blue-50',
        message: 'Air quality is acceptable and conditions are pleasant'
      },
      suitable: { 
        label: 'Suitable', 
        color: 'from-teal-500 to-green-500',
        textColor: 'text-teal-600',
        bgColor: 'bg-teal-50',
        message: 'Conditions are acceptable for most activities'
      },
      moderate: { 
        label: 'Moderate', 
        color: 'from-yellow-500 to-orange-400',
        textColor: 'text-yellow-700',
        bgColor: 'bg-yellow-50',
        message: 'Acceptable but may affect sensitive individuals'
      },
      poor: { 
        label: 'Poor', 
        color: 'from-orange-500 to-red-500',
        textColor: 'text-orange-600',
        bgColor: 'bg-orange-50',
        message: 'Consider limiting outdoor exposure'
      },
      hazardous: { 
        label: 'Hazardous', 
        color: 'from-red-600 to-red-800',
        textColor: 'text-red-700',
        bgColor: 'bg-red-50',
        message: 'Health warning! Avoid outdoor activities'
      }
    };
    return details[condition] || details.moderate;
  };

  const fetchSensorData = async () => {
    try {
      // Simulated data for demonstration
      // In production, replace with: const response = await fetch(`http://${ipAddress}/data`);
      const simulatedData = {
        mq135: 306,
        baseline: 200,
        deviation: 106,
        temperature: 26.70,
        humidity: 52.00
      };
      
      setData(simulatedData);
      setConnected(true);
      setError(null);
    } catch (err) {
      setError('Failed to connect to sensor');
      setConnected(false);
    }
  };

  const handleIpChange = () => {
    if (inputIp.trim()) {
      setIpAddress(inputIp);
      setIsConfigured(true);
      setConnected(false);
      setData(null);
      setError(null);
    }
  };

  const handleReconfigure = () => {
    setIsConfigured(false);
    setConnected(false);
    setData(null);
    setError(null);
  };

  useEffect(() => {
    if (isConfigured && ipAddress) {
      fetchSensorData();
      const interval = setInterval(fetchSensorData, 3000);
      return () => clearInterval(interval);
    }
  }, [ipAddress, isConfigured]);

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Wind className="w-12 h-12 text-blue-400" />
              <h1 className="text-3xl font-bold text-white">AQI Sensor</h1>
            </div>
            <p className="text-gray-400">Connect to your sensor module</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Sensor IP Address
              </label>
              <input
                type="text"
                value={inputIp}
                onChange={(e) => setInputIp(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleIpChange()}
                placeholder="192.168.4.1"
                className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              />
            </div>

            <button
              onClick={handleIpChange}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-lg"
            >
              Connect to Sensor
            </button>

            <div className="bg-slate-700 rounded-lg p-4 mt-6">
              <p className="text-sm text-gray-300 mb-2">
                <strong className="text-white">Instructions:</strong>
              </p>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Connect to your ESP8266 WiFi network</li>
                <li>• Enter the sensor's IP address (default: 192.168.4.1)</li>
                <li>• Click "Connect to Sensor" to start monitoring</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="text-white text-center">
          <WifiOff className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <p className="text-xl mb-2">Connecting to sensor...</p>
          <p className="text-gray-400">{ipAddress}</p>
          <button
            onClick={handleReconfigure}
            className="mt-6 px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Change IP Address
          </button>
        </div>
      </div>
    );
  }

  const condition = getEnvironmentCondition(
    data.mq135, 
    data.baseline, 
    data.temperature, 
    data.humidity
  );
  const conditionDetails = getConditionDetails(condition);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Wind className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400" />
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
              AQI Sensor Module
            </h1>
          </div>
          <div className="flex items-center justify-center gap-3 text-gray-400 mt-4">
            {connected ? (
              <>
                <Wifi className="w-5 h-5 text-green-400" />
                <span className="text-sm sm:text-base">{ipAddress}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-red-400" />
                <span className="text-sm sm:text-base">Disconnected</span>
              </>
            )}
            <button
              onClick={handleReconfigure}
              className="ml-2 p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              title="Change IP Address"
            >
              <Settings className="w-5 h-5 text-gray-300" />
            </button>
          </div>
        </div>

        {/* Environment Condition Card */}
        <div className={`rounded-3xl p-6 sm:p-8 mb-6 bg-gradient-to-r ${conditionDetails.color} shadow-2xl`}>
          <div className="text-center text-white">
            <p className="text-lg sm:text-xl opacity-90 mb-2">Environment Status</p>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-3">
              {conditionDetails.label}
            </h2>
            <p className="text-base sm:text-lg opacity-90">
              {conditionDetails.message}
            </p>
          </div>
        </div>

        {/* AQI Data Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Wind className="w-6 h-6 sm:w-7 sm:h-7 text-purple-600" />
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800">Air Quality</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-purple-50 rounded-xl p-4 sm:p-5">
              <p className="text-sm text-purple-600 font-medium mb-2">MQ135 Raw</p>
              <p className="text-3xl sm:text-4xl font-bold text-purple-900">{data.mq135}</p>
            </div>
            
            <div className="bg-blue-50 rounded-xl p-4 sm:p-5">
              <p className="text-sm text-blue-600 font-medium mb-2">Baseline</p>
              <p className="text-3xl sm:text-4xl font-bold text-blue-900">{data.baseline}</p>
            </div>
            
            <div className={`${conditionDetails.bgColor} rounded-xl p-4 sm:p-5`}>
              <p className={`text-sm font-medium mb-2 ${conditionDetails.textColor}`}>Deviation</p>
              <p className={`text-3xl sm:text-4xl font-bold ${conditionDetails.textColor}`}>
                {data.deviation > 0 ? '+' : ''}{data.deviation}
              </p>
            </div>
          </div>
        </div>

        {/* Climate Data Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Thermometer className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" />
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800">Temperature</h3>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-5 sm:p-6">
                <p className="text-4xl sm:text-5xl font-bold text-red-600">
                  {data.temperature.toFixed(2)}°C
                </p>
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Droplets className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500" />
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800">Humidity</h3>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 sm:p-6">
                <p className="text-4xl sm:text-5xl font-bold text-blue-600">
                  {data.humidity.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Auto Refresh Info */}
        <div className="text-center mt-6 text-gray-400 text-sm sm:text-base">
          <p>Auto refresh every 3 seconds</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-700 text-sm sm:text-base">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}