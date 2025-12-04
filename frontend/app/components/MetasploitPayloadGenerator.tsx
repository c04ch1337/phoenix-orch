import React, { useState } from 'react';
import { usePhoenixContext } from '../context/PhoenixContext';

interface PayloadOptions {
  payloadType: string;
  platform: string;
  lhost: string;
  lport: string;
  format: string;
  encoder?: string;
  [key: string]: any;
}

const MetasploitPayloadGenerator: React.FC = () => {
  const { netPentestApi } = usePhoenixContext();
  
  const [options, setOptions] = useState<PayloadOptions>({
    payloadType: 'windows/meterpreter/reverse_tcp',
    platform: 'windows',
    lhost: '192.168.1.100',
    lport: '4444',
    format: 'exe',
  });
  
  const [generatedPayload, setGeneratedPayload] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Options for dropdowns
  const payloadTypes = [
    { value: 'windows/meterpreter/reverse_tcp', label: 'Windows Meterpreter Reverse TCP' },
    { value: 'windows/meterpreter/reverse_https', label: 'Windows Meterpreter Reverse HTTPS' },
    { value: 'linux/x86/meterpreter/reverse_tcp', label: 'Linux x86 Meterpreter Reverse TCP' },
    { value: 'linux/x64/meterpreter/reverse_tcp', label: 'Linux x64 Meterpreter Reverse TCP' },
    { value: 'osx/x64/meterpreter/reverse_tcp', label: 'macOS x64 Meterpreter Reverse TCP' },
    { value: 'android/meterpreter/reverse_tcp', label: 'Android Meterpreter Reverse TCP' },
  ];
  
  const formats = [
    { value: 'exe', label: 'Windows Executable (.exe)' },
    { value: 'dll', label: 'Windows DLL (.dll)' },
    { value: 'elf', label: 'Linux ELF Binary' },
    { value: 'macho', label: 'macOS Binary' },
    { value: 'raw', label: 'Raw Shellcode' },
    { value: 'js', label: 'JavaScript' },
    { value: 'python', label: 'Python' },
    { value: 'powershell', label: 'PowerShell' },
  ];
  
  const encoders = [
    { value: '', label: 'No Encoding' },
    { value: 'x86/shikata_ga_nai', label: 'Shikata Ga Nai' },
    { value: 'x64/xor', label: 'XOR Encoder' },
    { value: 'cmd/powershell_base64', label: 'PowerShell Base64' },
  ];
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setOptions(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsGenerating(true);
    
    try {
      const result = await netPentestApi.generateMetasploitPayload(options);
      setGeneratedPayload(result);
    } catch (err) {
      setError(`Failed to generate payload: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleDownload = () => {
    if (!generatedPayload || !generatedPayload.data) return;
    
    // Create blob from base64 data
    const byteCharacters = atob(generatedPayload.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray]);
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payload.${options.format}`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };
  
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-red-400">Metasploit Payload Generator</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-300 mb-2">Payload Type:</label>
          <select
            name="payloadType"
            value={options.payloadType}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {payloadTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-gray-300 mb-2">LHOST (Listener Host):</label>
          <input
            type="text"
            name="lhost"
            value={options.lhost}
            onChange={handleChange}
            placeholder="e.g., 192.168.1.100"
            className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        
        <div>
          <label className="block text-gray-300 mb-2">LPORT (Listener Port):</label>
          <input
            type="text"
            name="lport"
            value={options.lport}
            onChange={handleChange}
            placeholder="e.g., 4444"
            className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        
        <div>
          <label className="block text-gray-300 mb-2">Output Format:</label>
          <select
            name="format"
            value={options.format}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {formats.map(format => (
              <option key={format.value} value={format.value}>
                {format.label}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-gray-300 mb-2">Encoder (optional):</label>
          <select
            name="encoder"
            value={options.encoder || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {encoders.map(encoder => (
              <option key={encoder.value} value={encoder.value}>
                {encoder.label}
              </option>
            ))}
          </select>
        </div>
        
        <button
          type="submit"
          disabled={isGenerating}
          className={`px-6 py-2 rounded font-semibold ${
            isGenerating
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800'
          }`}
        >
          {isGenerating ? 'Generating...' : 'Generate Payload'}
        </button>
      </form>
      
      {error && (
        <div className="mt-4 p-3 bg-red-800 text-white rounded">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {generatedPayload && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold text-red-400 mb-2">Generated Payload</h3>
          <div className="bg-gray-700 rounded p-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-300 font-semibold">
                Size: {generatedPayload.size} bytes | SHA256: {generatedPayload.sha256.substring(0, 16)}...
              </span>
              <button
                onClick={handleDownload}
                className="px-4 py-1 bg-red-600 text-white rounded hover:bg-red-500 focus:outline-none"
              >
                Download
              </button>
            </div>
            
            {generatedPayload.instructions && (
              <div className="mt-2">
                <h4 className="text-md font-semibold text-gray-300 mb-1">Usage Instructions:</h4>
                <pre className="bg-black p-3 rounded text-green-400 overflow-x-auto">
                  {generatedPayload.instructions}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MetasploitPayloadGenerator;