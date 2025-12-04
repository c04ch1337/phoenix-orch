/**
 * Reporting Visualizations
 * 
 * Provides data visualization components for security reports, including charts,
 * graphs, network diagrams, and interactive dashboards.
 */

// Import visualization generators (these would be actual visualization modules in a real implementation)
const chartGenerator = require('./chart_generator');
const networkDiagramGenerator = require('./network_diagram_generator');
const timelineGenerator = require('./timeline_generator');
const heatMapGenerator = require('./heat_map_generator');
const treemapGenerator = require('./treemap_generator');

module.exports = {
    // Visualization generators
    chartGenerator,
    networkDiagramGenerator,
    timelineGenerator,
    heatMapGenerator,
    treemapGenerator,
    
    // Helper functions
    generateVisualization: async (type, data, options = {}) => {
        switch (type) {
            case 'bar_chart':
            case 'pie_chart':
            case 'line_chart':
                return chartGenerator.generate(type, data, options);
                
            case 'network_diagram':
                return networkDiagramGenerator.generate(data, options);
                
            case 'timeline':
                return timelineGenerator.generate(data, options);
                
            case 'heat_map':
                return heatMapGenerator.generate(data, options);
                
            case 'treemap':
                return treemapGenerator.generate(data, options);
                
            default:
                throw new Error(`Unsupported visualization type: ${type}`);
        }
    }
};