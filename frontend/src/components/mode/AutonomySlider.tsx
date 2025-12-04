import React, { useState, useEffect } from 'react';
import { Slider, Switch, Button, Tooltip, Space, Badge, Tag, Divider, message } from 'antd';
import { RocketOutlined, RobotOutlined, LockOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { invokeAgent } from '../../services/api';

// Define the props for the AutonomySlider component
interface AutonomySliderProps {
  taskId?: string;
  userId: string;
  initialLevel?: number;
  initialFastMode?: boolean;
  onChange?: (level: number, fastMode: boolean) => void;
  disabled?: boolean;
}

// Define the labels and descriptions for different autonomy levels
const autonomyLevels = [
  { value: 0, label: 'Planning Only', color: '#8c8c8c', description: 'Agents only create plans, requiring approval for each step' },
  { value: 1, label: 'Minimal', color: '#91caff', description: 'Agents can execute simple operations with frequent verification' },
  { value: 2, label: 'Very Low', color: '#91caff', description: 'Agents can execute simple operations with frequent verification' },
  { value: 3, label: 'Low', color: '#91caff', description: 'Agents can execute simple operations with frequent verification' },
  { value: 4, label: 'Limited', color: '#52c41a', description: 'Agents have more autonomy with periodic verification' },
  { value: 5, label: 'Medium', color: '#52c41a', description: 'Agents have more autonomy with periodic verification' },
  { value: 6, label: 'Moderate', color: '#52c41a', description: 'Agents have more autonomy with periodic verification' },
  { value: 7, label: 'High', color: '#fa8c16', description: 'Agents have high autonomy with minimal verification' },
  { value: 8, label: 'Very High', color: '#fa8c16', description: 'Agents have high autonomy with minimal verification' },
  { value: 9, label: 'Advanced', color: '#fa8c16', description: 'Agents have high autonomy with minimal verification' },
  { value: 10, label: 'Full Auto', color: '#f5222d', description: 'Agents operate in full autonomous mode (including terminal and browser)' },
];

// Permission badges for different capability types
const PermissionBadge = ({ 
  active, 
  label, 
  title 
}: { 
  active: boolean; 
  label: string; 
  title: string;
}) => (
  <Tooltip title={title}>
    <Badge 
      status={active ? "success" : "default"} 
      text={label} 
      style={{ marginRight: 12 }}
    />
  </Tooltip>
);

/**
 * AutonomySlider Component
 * 
 * Displays a slider with values from 0 (Planning only) to 10 (Full auto)
 * and shows the autonomy level settings visually.
 * 
 * Also includes Fast Mode toggle for one-shot execution of trivial tasks.
 */
const AutonomySlider: React.FC<AutonomySliderProps> = ({
  taskId,
  userId,
  initialLevel = 0,
  initialFastMode = false,
  onChange,
  disabled = false,
}) => {
  const [level, setLevel] = useState<number>(initialLevel);
  const [fastMode, setFastMode] = useState<boolean>(initialFastMode);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Get the current level info
  const currentLevel = autonomyLevels.find(l => l.value === level) || autonomyLevels[0];
  
  // Calculate permissions based on level
  const permissions = {
    fileAccess: level > 0,
    commandExecution: level >= 2,
    terminalAccess: level >= 3,
    browserAccess: level >= 5,
    requiresVerification: level < 10,
    verificationFrequency: level < 10 ? 10 - level : 0,
  };

  // Update the backend when level or fast mode changes
  useEffect(() => {
    if (onChange) {
      onChange(level, fastMode);
    }
  }, [level, fastMode, onChange]);

  // Handle changing the autonomy level
  const handleSliderChange = async (newLevel: number) => {
    try {
      setLoading(true);
      
      // Call the backend API to update the autonomy level
      await invokeAgent('set_autonomy_level', {
        userId,
        level: newLevel,
      });
      
      setLevel(newLevel);
      message.success(`Autonomy level set to ${newLevel} - ${autonomyLevels[newLevel].label}`);
    } catch (error) {
      message.error('Failed to update autonomy level');
      console.error('Error setting autonomy level:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle toggling fast mode
  const handleFastModeToggle = async (checked: boolean) => {
    try {
      setLoading(true);
      
      // Call the backend API to update the operating mode
      await invokeAgent('set_operating_mode', {
        userId,
        mode: checked ? 'Fast' : 'Planning',
      });
      
      // If we have a task ID, apply fast mode to the specific task too
      if (taskId && checked) {
        await invokeAgent('enable_fast_mode_for_task', {
          userId,
          taskId,
        });
      }
      
      setFastMode(checked);
      message.success(`Fast Mode ${checked ? 'enabled' : 'disabled'}`);
    } catch (error) {
      message.error('Failed to update Fast Mode');
      console.error('Error setting Fast Mode:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle quick command for "Phoenix, fast mode this task"
  const handleFastModeCommand = async () => {
    if (!taskId) {
      message.warning('No active task to apply Fast Mode to');
      return;
    }
    
    try {
      setLoading(true);
      
      // Process the fast mode command
      await invokeAgent('process_fast_mode_command', {
        commandText: 'Phoenix, fast mode this task',
        taskId,
        userId,
      });
      
      setFastMode(true);
      message.success('Fast Mode enabled via command');
    } catch (error) {
      message.error('Failed to enable Fast Mode');
      console.error('Error processing Fast Mode command:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="autonomy-slider-container" style={{ padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>
          <RobotOutlined /> Autonomy Control
        </h3>
        <Space>
          <Tooltip title="Fast Mode bypasses planning phase for trivial tasks, executing them directly">
            <Switch
              checkedChildren="Fast Mode"
              unCheckedChildren="Planning Mode"
              checked={fastMode}
              onChange={handleFastModeToggle}
              loading={loading}
              disabled={disabled}
            />
          </Tooltip>
          {taskId && (
            <Tooltip title="Apply Fast Mode to current task">
              <Button
                type="primary"
                icon={<RocketOutlined />}
                onClick={handleFastModeCommand}
                loading={loading}
                disabled={disabled || fastMode}
                size="small"
              >
                Fast Mode This Task
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>
      
      <div style={{ marginBottom: '12px' }}>
        <Tag color={currentLevel.color} style={{ marginBottom: '8px' }}>
          Level {level}: {currentLevel.label}
        </Tag>
        <p style={{ fontSize: '0.9em', color: '#666', margin: '4px 0' }}>
          {currentLevel.description}
        </p>
      </div>
      
      <Slider
        min={0}
        max={10}
        value={level}
        onChange={handleSliderChange}
        marks={{
          0: { label: 'Planning', style: { color: '#8c8c8c' } },
          5: { label: 'Medium', style: { color: '#52c41a' } },
          10: { label: 'Full Auto', style: { color: '#f5222d' } }
        }}
        disabled={disabled || loading}
        tooltipVisible
        tooltipPlacement="bottom"
        tooltip={{
          formatter: (value) => {
            const lvl = autonomyLevels.find(l => l.value === value);
            return lvl ? `${value}: ${lvl.label}` : value;
          }
        }}
      />
      
      <Divider style={{ margin: '16px 0' }} />
      
      <div className="autonomy-permissions" style={{ marginTop: '8px' }}>
        <h4 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center' }}>
          <LockOutlined style={{ marginRight: '8px' }} /> Permissions 
          <Tooltip title="What the agent is allowed to do at this autonomy level">
            <QuestionCircleOutlined style={{ fontSize: '14px', marginLeft: '8px', color: '#1890ff' }} />
          </Tooltip>
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <PermissionBadge 
            active={permissions.fileAccess} 
            label="File Access" 
            title="Agent can read and write files"
          />
          <PermissionBadge 
            active={permissions.commandExecution} 
            label="Commands" 
            title="Agent can execute commands"
          />
          <PermissionBadge 
            active={permissions.terminalAccess} 
            label="Terminal" 
            title="Agent can use the terminal"
          />
          <PermissionBadge 
            active={permissions.browserAccess} 
            label="Browser" 
            title="Agent can control the browser"
          />
        </div>
        {permissions.requiresVerification && (
          <div style={{ marginTop: '8px', fontSize: '0.85em', color: '#666' }}>
            <span>Verification frequency: </span>
            {permissions.verificationFrequency <= 3 ? (
              <span style={{ color: '#f5222d' }}>High</span>
            ) : permissions.verificationFrequency <= 7 ? (
              <span style={{ color: '#fa8c16' }}>Medium</span>
            ) : (
              <span style={{ color: '#52c41a' }}>Low</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AutonomySlider;