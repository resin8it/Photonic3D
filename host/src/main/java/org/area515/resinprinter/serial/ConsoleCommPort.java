package org.area515.resinprinter.serial;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.area515.resinprinter.printer.ComPortSettings;
import org.area515.resinprinter.printer.Printer;
import org.area515.resinprinter.printer.PrinterManager;

public class ConsoleCommPort implements SerialCommunicationsPort {
    private static final Logger logger = LogManager.getLogger();
	public static final String GCODE_RESPONSE_SIMULATION = "GCode response simulation";
	private static int consoleNumber = 0;
	
	private String name = GCODE_RESPONSE_SIMULATION;
	private int readCount;
	private int timeout;
	
	private ConsoleCommPort() {
	}
	
	private ConsoleCommPort(int consoleNumber) {
		this.name = this.name + ":" + consoleNumber;
	}
	
	public static ConsoleCommPort getSelectableConsoleCommPort() {
		return new ConsoleCommPort();
	}
	public static ConsoleCommPort getNextAvailableConsoleCommPort() {
		return new ConsoleCommPort(consoleNumber++);
	}
	
	@Override
	public void open(String printerName, int timeout, ComPortSettings settings) {
		readCount = 0;
		this.timeout = timeout;
		logger.info("Printer opened");
	}

	@Override
	public void close() {
		logger.info("Printer closed");
	}

	@Override
	public void setName(String name) {
		this.name = name;
	}

	@Override
	public String getName() {
		return name;
	}

	@Override
	public void write(byte[] gcode) {
		logger.info("Printer received:{}", new String(gcode));
	}
	
	@Override
	public void changeHeight(byte[] gcode, String printerName) {
		//send gcode
		String gcodeString = new String(gcode);
		//patterns
		Pattern homingPattern = Pattern.compile("^G28\\b", Pattern.CASE_INSENSITIVE);
		Pattern G1Pattern = Pattern.compile("^G1\\b", Pattern.CASE_INSENSITIVE);
		Pattern movingPattern = Pattern.compile("\\bZ-?[0-9]+(?:[,.][0-9]+)?", Pattern.CASE_INSENSITIVE);

		Printer printer = PrinterManager.Instance().getPrinter(printerName);
		Matcher matcher;
		
		matcher = G1Pattern.matcher(gcodeString);
		if (matcher.lookingAt()) {
			matcher = movingPattern.matcher(gcodeString);
			if (matcher.find()) {
				String movingHeight = matcher.group().substring(1);
				double platformHeight = printer.getCurrentPlatformHeight() + Double.parseDouble(movingHeight);
				logger.info("Found: Moving command, new platform height is " + platformHeight);	
				printer.setCurrentPlatformHeight(platformHeight);						
			}
		}
		
		matcher = homingPattern.matcher(gcodeString);
		if (matcher.lookingAt()) {
			printer.setCurrentPlatformHeight(0);
			logger.info("Found homing command, resetting platform height to 0");
		}
	}

	@Override
	public byte[] read() {
		switch (readCount) {
		case 0:
			readCount = 1;
			return "Console chitchat\n".getBytes();
		case 1:
			try {
				Thread.sleep(timeout+1);
			} catch (InterruptedException e) {}
			readCount = 2;
			return null;
		}
		
		return "ok\n".getBytes();
	}

	@Override
	public void restartCommunications() {
	}

	public String toString() {
		return name;
	}
	
	@Override
	public int hashCode() {
		final int prime = 31;
		int result = 1;
		result = prime * result + ((name == null) ? 0 : name.hashCode());
		return result;
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		ConsoleCommPort other = (ConsoleCommPort) obj;
		if (name == null) {
			if (other.name != null)
				return false;
		} else if (!name.equals(other.name))
			return false;
		return true;
	}
}
