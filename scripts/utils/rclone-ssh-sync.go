package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Styles using lipgloss (Bubble Tea's styling library)
var (
	pinkStyle   = lipgloss.NewStyle().Foreground(lipgloss.Color("212"))
	purpleStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("57"))
	greenStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("10"))
	yellowStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("11"))
	redStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("9"))
	whiteStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("255"))
	boldStyle   = lipgloss.NewStyle().Bold(true)

	doubleBoxStyle = lipgloss.NewStyle().
			BorderStyle(lipgloss.DoubleBorder()).
			BorderForeground(lipgloss.Color("212")).
			Padding(1, 2).
			Margin(1, 0)

	infoBoxStyle = lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("57")).
			Foreground(lipgloss.Color("255")).
			Padding(1, 2).
			Margin(1, 0)

	successBoxStyle = lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("10")).
			Foreground(lipgloss.Color("10")).
			Padding(1, 2).
			Margin(1, 0)

	warningBoxStyle = lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("11")).
			Foreground(lipgloss.Color("255")).
			Padding(1, 2).
			Margin(1, 0)

	errorBoxStyle = lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("9")).
			Foreground(lipgloss.Color("255")).
			Padding(1, 2).
			Margin(1, 0)

	headerStyle = lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("212")).
			Foreground(lipgloss.Color("212")).
			Padding(1, 2).
			Margin(1, 0)
)

var _ = []lipgloss.Style{pinkStyle, yellowStyle, redStyle, whiteStyle, boldStyle, warningBoxStyle}

// Configuration
type config struct {
	remoteName     string
	remoteHost     string
	remoteUser     string
	localDir       string
	remoteBasePath string
	exclusionFile  string
	logDir         string
	sshKey         string
}

func defaultConfig() config {
	homeDir, _ := os.UserHomeDir()
	sshKey := os.Getenv("SSH_KEY")
	if sshKey == "" {
		sshKey = os.Getenv("PLANET_KEY")
	}
	if sshKey == "" {
		// Try common locations
		commonKeys := []string{
			filepath.Join(homeDir, ".ssh", "planet"),
			filepath.Join(homeDir, ".ssh", "id_rsa"),
			filepath.Join(homeDir, ".ssh", "id_ed25519"),
		}
		for _, key := range commonKeys {
			if _, err := os.Stat(key); err == nil {
				sshKey = key
				break
			}
		}
	}

	scriptDir := filepath.Dir(os.Args[0])
	if scriptDir == "." {
		execPath, err := os.Executable()
		if err == nil {
			scriptDir = filepath.Dir(execPath)
		}
	}

	return config{
		remoteName:     "planet",
		remoteHost:     "146.71.78.184",
		remoteUser:     "vivi",
		localDir:       filepath.Join(homeDir, "pixelated"),
		remoteBasePath: "~/pixelated",
		exclusionFile:  filepath.Join(scriptDir, "rclone-exclusions-list.txt"),
		logDir:         filepath.Join(os.TempDir(), fmt.Sprintf("rclone-ssh-sync-%d", os.Getpid())),
		sshKey:         sshKey,
	}
}

// Model represents the application state
type model struct {
	config           config
	state            string // "init", "checking", "configuring", "generating", "syncing", "done", "error"
	messages         []string
	currentFile      string
	progress         string
	err              error
	width            int
	height           int
	spinnerFrame     int
	exclusionCount   int
	gitCount         int
	nodeModulesCount int
}

func initialModel(cfg config) model {
	return model{
		config:   cfg,
		state:    "init",
		messages: []string{},
	}
}

// Messages
type (
	errMsg            struct{ err error }
	statusMsg         struct{ msg string }
	progressMsg       struct{ file, progress string }
	stateChangeMsg    struct{ state string }
	spinnerTickMsg    struct{}
	exclusionCountMsg struct{ git, nodeModules int }
)

// Spinner frames
var spinnerFrames = []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

func (m model) Init() tea.Cmd {
	return tea.Batch(
		checkRclone,
		checkSSHKey(m.config),
		spinnerTick,
	)
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		}
		return m, nil

	case spinnerTickMsg:
		m.spinnerFrame = (m.spinnerFrame + 1) % len(spinnerFrames)
		if m.state == "checking" || m.state == "configuring" || m.state == "generating" || m.state == "syncing" {
			return m, spinnerTick
		}
		return m, nil

	case errMsg:
		m.err = msg.err
		m.state = "error"
		return m, nil

	case statusMsg:
		m.messages = append(m.messages, msg.msg)
		if len(m.messages) > 10 {
			m.messages = m.messages[len(m.messages)-10:]
		}
		return m, m.handleStateTransitions()

	case progressMsg:
		m.currentFile = msg.file
		m.progress = msg.progress
		return m, nil

	case stateChangeMsg:
		m.state = msg.state
		return m, m.handleStateTransitions()

	case exclusionCountMsg:
		m.gitCount = msg.git
		m.nodeModulesCount = msg.nodeModules
		m.exclusionCount = msg.git + msg.nodeModules
		return m, m.handleStateTransitions()

	default:
		return m, nil
	}
}

func (m model) handleStateTransitions() tea.Cmd {
	switch m.state {
	case "init":
		if m.err == nil && len(m.messages) >= 2 {
			// Both rclone and SSH key checks passed
			return tea.Sequence(
				func() tea.Msg { return stateChangeMsg{"checking"} },
				checkRemote(m.config),
			)
		}
	case "checking":
		// Check if remote needs configuration or is already configured
		allMessages := strings.Join(m.messages, " ")
		if strings.Contains(allMessages, "Remote connection test successful") ||
			strings.Contains(allMessages, "already configured and connected") {
			// Remote is ready, generate exclusions
			return tea.Sequence(
				func() tea.Msg { return stateChangeMsg{"generating"} },
				generateExclusions(m.config),
			)
		} else if strings.Contains(allMessages, "Reconfiguring") ||
			strings.Contains(allMessages, "not found. Need to configure") {
			// Need to configure remote
			return tea.Sequence(
				func() tea.Msg { return stateChangeMsg{"configuring"} },
				configureRemote(m.config),
			)
		}
		return nil
	case "configuring":
		// After configuring successfully, test connection
		allMessages := strings.Join(m.messages, " ")
		if strings.Contains(allMessages, "configured successfully") &&
			!strings.Contains(allMessages, "Remote connection test") {
			// Just configured, now test it
			return testRemote(m.config)
		} else if strings.Contains(allMessages, "Remote connection test successful") {
			// Test passed after configuration, proceed to generating
			return tea.Sequence(
				func() tea.Msg { return stateChangeMsg{"generating"} },
				generateExclusions(m.config),
			)
		}
		return nil
	case "generating":
		// After generating exclusions, add status message then start sync
		if m.exclusionCount > 0 {
			return tea.Sequence(
				func() tea.Msg { return generateExclusionsStatus(m.gitCount, m.nodeModulesCount) },
				func() tea.Msg {
					time.Sleep(200 * time.Millisecond)
					return stateChangeMsg{"syncing"}
				},
				startSync(m.config),
			)
		} else if len(m.messages) > 0 {
			// If we have messages but no count yet, might still be generating
			// Check if we have the exclusion message
			allMessages := strings.Join(m.messages, " ")
			if strings.Contains(allMessages, "Exclusion list generated") && m.exclusionCount == 0 {
				// Still waiting for exclusion count
				return nil
			}
		}
	}
	return nil
}

func (m model) View() string {
	if m.width == 0 {
		return "Loading..."
	}

	var s strings.Builder

	// Header
	title := doubleBoxStyle.
		Width(m.width - 4).
		Align(lipgloss.Center).
		Render(
			"🚀 Rclone SSH Sync\n" +
				"Pixelated Repository",
		)
	s.WriteString(title)
	s.WriteString("\n")

	// State-specific UI
	switch m.state {
	case "init", "checking", "configuring", "generating":
		spinner := purpleStyle.Render(spinnerFrames[m.spinnerFrame])
		statusText := ""
		switch m.state {
		case "checking":
			statusText = "Checking remote configuration..."
		case "configuring":
			statusText = "Configuring remote..."
		case "generating":
			statusText = fmt.Sprintf("Generating exclusion list... (%d found)", m.exclusionCount)
		default:
			statusText = "Initializing..."
		}
		statusBox := headerStyle.Width(m.width - 4).Render(
			fmt.Sprintf("%s %s", spinner, statusText),
		)
		s.WriteString(statusBox)
		s.WriteString("\n")

	case "syncing":
		syncHeader := headerStyle.Width(m.width - 4).Render(
			fmt.Sprintf("%s Syncing files...", spinnerFrames[m.spinnerFrame]),
		)
		s.WriteString(syncHeader)
		s.WriteString("\n\n")
	}

	// Status messages (last 5)
	if len(m.messages) > 0 {
		recentMessages := m.messages
		if len(recentMessages) > 5 {
			recentMessages = recentMessages[len(recentMessages)-5:]
		}
		box := infoBoxStyle.Width(m.width - 4).Render(
			strings.Join(recentMessages, "\n"),
		)
		s.WriteString(box)
		s.WriteString("\n")
	}

	// Exclusion count
	if m.exclusionCount > 0 {
		exclusionBox := infoBoxStyle.Width(m.width - 4).Render(
			fmt.Sprintf("Exclusions: %d .git directories, %d node_modules directories",
				m.gitCount, m.nodeModulesCount),
		)
		s.WriteString(exclusionBox)
		s.WriteString("\n\n")
	}

	// Current progress
	if m.progress != "" {
		progressBox := infoBoxStyle.Width(m.width - 4).Render(
			fmt.Sprintf("Progress:\n%s", m.progress),
		)
		s.WriteString(progressBox)
		s.WriteString("\n\n")
	}

	if m.currentFile != "" {
		currentBox := infoBoxStyle.Width(m.width - 4).Render(
			fmt.Sprintf("Current file:\n%s", m.currentFile),
		)
		s.WriteString(currentBox)
		s.WriteString("\n\n")
	}

	// Error display
	if m.err != nil {
		errorBox := errorBoxStyle.Width(m.width - 4).Render(
			fmt.Sprintf("Error: %v", m.err),
		)
		s.WriteString(errorBox)
		s.WriteString("\n\n")
	}

	// Success message
	if m.state == "done" {
		successBox := successBoxStyle.Width(m.width - 4).Render(
			"✓ Sync completed successfully!",
		)
		s.WriteString(successBox)
		s.WriteString("\n\n")
	}

	// Footer
	footer := greenStyle.Render("Press 'q' or Ctrl+C to quit")
	s.WriteString(footer)

	return lipgloss.NewStyle().
		Width(m.width).
		Height(m.height).
		Align(lipgloss.Center, lipgloss.Center).
		Render(s.String())
}

// Commands
func checkRclone() tea.Msg {
	_, err := exec.LookPath("rclone")
	if err != nil {
		return errMsg{fmt.Errorf("rclone is not installed. Please install it first: https://rclone.org/install/")}
	}
	return statusMsg{"✓ rclone found"}
}

func checkSSHKey(cfg config) tea.Cmd {
	return func() tea.Msg {
		if cfg.sshKey == "" {
			return errMsg{fmt.Errorf("ssh key not found. please set SSH_KEY or PLANET_KEY environment variable")}
		}
		if _, err := os.Stat(cfg.sshKey); os.IsNotExist(err) {
			return errMsg{fmt.Errorf("ssh key file not found: %s", cfg.sshKey)}
		}
		return statusMsg{fmt.Sprintf("✓ Using SSH key: %s", cfg.sshKey)}
	}
}

func checkRemote(cfg config) tea.Cmd {
	return func() tea.Msg {
		// Check if remote exists
		cmd := exec.Command("rclone", "listremotes")
		output, err := cmd.Output()
		if err != nil {
			return statusMsg{"Checking remote configuration..."}
		}

		remotePattern := cfg.remoteName + ":"
		if strings.Contains(string(output), remotePattern) {
			// Test connection
			testCmd := exec.Command("rclone", "lsd", remotePattern)
			testCmd.Stderr = nil
			testCmd.Stdout = nil
			if err := testCmd.Run(); err == nil {
				return statusMsg{"✓ Remote '" + cfg.remoteName + "' already configured and connected"}
			} else {
				// Trigger reconfiguration
				return statusMsg{"⚠ Remote exists but connection failed. Reconfiguring..."}
			}
		}

		// Need to create remote - trigger configuration
		return statusMsg{"Remote '" + cfg.remoteName + "' not found. Need to configure..."}
	}
}

func configureRemote(cfg config) tea.Cmd {
	return func() tea.Msg {
		logFile := filepath.Join(cfg.logDir, "remote-config.log")

		cmd := exec.Command("rclone", "config", "create",
			cfg.remoteName, "sftp",
			"host", cfg.remoteHost,
			"user", cfg.remoteUser,
			"key_file", cfg.sshKey,
			"shell_type", "unix",
			"md5sum_command", "md5sum",
			"sha1sum_command", "sha1sum",
		)

		file, err := os.Create(logFile)
		if err == nil {
			cmd.Stdout = file
			cmd.Stderr = file
		}

		if err := cmd.Run(); err != nil {
			return errMsg{fmt.Errorf("failed to configure remote: %v", err)}
		}
		if file != nil {
			_ = file.Close()
		}

		return statusMsg{"✓ Remote '" + cfg.remoteName + "' configured successfully"}
	}
}

func testRemote(cfg config) tea.Cmd {
	return func() tea.Msg {
		cmd := exec.Command("rclone", "lsd", cfg.remoteName+":")
		cmd.Stderr = nil
		cmd.Stdout = nil
		if err := cmd.Run(); err == nil {
			// Return a batch of messages: status then state change to proceed
			return statusMsg{"✓ Remote connection test successful"}
		} else {
			return statusMsg{"⚠ Remote configured but connection test failed"}
		}
	}
}

func generateExclusions(cfg config) tea.Cmd {
	return func() tea.Msg {
		gitCount := 0
		nodeModulesCount := 0

		// Create exclusion file
		file, err := os.Create(cfg.exclusionFile)
		if err != nil {
			return errMsg{fmt.Errorf("failed to create exclusion file: %v", err)}
		}

		writer := bufio.NewWriter(file)
		if _, err := writer.WriteString("# Rclone SSH Sync Exclusion List\n"); err != nil {
			_ = file.Close()
			return errMsg{fmt.Errorf("failed to write exclusion file: %v", err)}
		}
		if _, err := writer.WriteString("# Generated: " + time.Now().UTC().Format(time.RFC3339) + "\n"); err != nil {
			_ = file.Close()
			return errMsg{fmt.Errorf("failed to write exclusion file: %v", err)}
		}
		if _, err := writer.WriteString("# Repository: " + cfg.localDir + "\n\n"); err != nil {
			_ = file.Close()
			return errMsg{fmt.Errorf("failed to write exclusion file: %v", err)}
		}

		// Find .git directories
		if walkErr := filepath.Walk(cfg.localDir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if info.IsDir() && info.Name() == ".git" {
				relPath, _ := filepath.Rel(cfg.localDir, path)
				if _, err := writer.WriteString(relPath + "\n"); err != nil {
					return err
				}
				gitCount++
			}
			return nil
		}); walkErr != nil {
			_ = file.Close()
			return errMsg{fmt.Errorf("failed to scan for .git directories: %v", walkErr)}
		}

		// Find node_modules directories
		if walkErr := filepath.Walk(cfg.localDir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if info.IsDir() && info.Name() == "node_modules" {
				relPath, _ := filepath.Rel(cfg.localDir, path)
				if _, err := writer.WriteString(relPath + "\n"); err != nil {
					return err
				}
				nodeModulesCount++
			}
			return nil
		}); walkErr != nil {
			_ = file.Close()
			return errMsg{fmt.Errorf("failed to scan for node_modules directories: %v", walkErr)}
		}

		if err := writer.Flush(); err != nil {
			_ = file.Close()
			return errMsg{fmt.Errorf("failed to flush exclusion file: %v", err)}
		}
		if err := file.Close(); err != nil {
			return errMsg{fmt.Errorf("failed to close exclusion file: %v", err)}
		}

		// Return both messages using tea.Batch
		// For now, return the exclusion count as the primary message
		// The status message will be added separately
		return exclusionCountMsg{git: gitCount, nodeModules: nodeModulesCount}
	}
}

func generateExclusionsStatus(gitCount, nodeModulesCount int) tea.Msg {
	return statusMsg{fmt.Sprintf("✓ Exclusion list generated: %d .git, %d node_modules", gitCount, nodeModulesCount)}
}

func startSync(cfg config) tea.Cmd {
	return func() tea.Msg {
		// Run sync in background
		go func() {
			// Build rclone command
			logFile := filepath.Join(cfg.logDir, "rclone.log")

			args := []string{
				"copy",
				cfg.localDir,
				cfg.remoteName + ":" + cfg.remoteBasePath,
				"--exclude", "**/.git/**",
				"--exclude", "**/.git",
				"--exclude", "**/node_modules/**",
				"--exclude", "**/node_modules",
				"--ignore-existing",
				"--progress",
				"--stats=5s",
				"--stats-one-line",
				"--stats-log-level=NOTICE",
				"--transfers=8",
				"--checkers=4",
				"--fast-list",
				"--buffer-size=64M",
				"--log-level=NOTICE",
				"--log-file=" + logFile,
			}

			cmd := exec.Command("rclone", args...)
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr

			if err := cmd.Run(); err != nil {
				if exitErr, ok := err.(*exec.ExitError); ok {
					if exitErr.ExitCode() == 1 {
						return
					}
				}
				return
			}
		}()

		return statusMsg{"Sync started in background. Check log file for progress."}
	}
}

func spinnerTick() tea.Msg {
	time.Sleep(100 * time.Millisecond)
	return spinnerTickMsg{}
}

func main() {
	cfg := defaultConfig()

	// Create log directory
	if err := os.MkdirAll(cfg.logDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Error creating log directory: %v\n", err)
		os.Exit(1)
	}

	// Handle signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		// Cleanup
		os.Exit(130)
	}()

	p := tea.NewProgram(initialModel(cfg), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error running program: %v\n", err)
		os.Exit(1)
	}

	// Cleanup
	if err := os.RemoveAll(cfg.logDir); err != nil {
		fmt.Fprintf(os.Stderr, "Error cleaning up log directory: %v\n", err)
	}
}
