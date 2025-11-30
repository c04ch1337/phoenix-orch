/**
 * Ecosystem Weaver Styles
 * 
 * Ashen Guard aesthetic styles for the Ecosystem Weaver module
 */

export const ecosystemStyles = {
    background: '#0A0A0A',
    primary: '#FF7F00', // Blood orange
    secondary: '#00FFFF', // Cyan
    accent: '#E63946', // Blood red
    text: '#E5E7EB', // Ash gray
    void: '#000000',
    
    // Glow effects
    glowOrange: '0 0 20px rgba(255, 127, 0, 0.5)',
    glowCyan: '0 0 20px rgba(0, 255, 255, 0.5)',
    glowRed: '0 0 20px rgba(230, 57, 70, 0.5)',
    
    // Thread particles
    threadColor: {
        active: '#00FFFF',
        pending: '#FF7F00',
        error: '#E63946',
    },
};

export const frameworkColors: Record<string, { bg: string; border: string; glow: string }> = {
    CrewAI: { bg: 'rgba(0, 255, 255, 0.1)', border: '#00FFFF', glow: ecosystemStyles.glowCyan },
    LangGraph: { bg: 'rgba(255, 127, 0, 0.1)', border: '#FF7F00', glow: ecosystemStyles.glowOrange },
    AutoGen: { bg: 'rgba(230, 57, 70, 0.1)', border: '#E63946', glow: ecosystemStyles.glowRed },
    Antigravity: { bg: 'rgba(255, 215, 0, 0.1)', border: '#FFD700', glow: '0 0 20px rgba(255, 215, 0, 0.5)' },
    NotebookLM: { bg: 'rgba(0, 255, 255, 0.1)', border: '#00FFFF', glow: ecosystemStyles.glowCyan },
    Notion: { bg: 'rgba(255, 127, 0, 0.1)', border: '#FF7F00', glow: ecosystemStyles.glowOrange },
    LlamaIndex: { bg: 'rgba(230, 57, 70, 0.1)', border: '#E63946', glow: ecosystemStyles.glowRed },
    SemanticKernel: { bg: 'rgba(0, 255, 255, 0.1)', border: '#00FFFF', glow: ecosystemStyles.glowCyan },
    MetaGPT: { bg: 'rgba(255, 127, 0, 0.1)', border: '#FF7F00', glow: ecosystemStyles.glowOrange },
    OpenAI_Swarm: { bg: 'rgba(230, 57, 70, 0.1)', border: '#E63946', glow: ecosystemStyles.glowRed },
};

