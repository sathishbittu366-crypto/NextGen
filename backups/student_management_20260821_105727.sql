-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: student_management
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `academic_calendar`
--

DROP TABLE IF EXISTS `academic_calendar`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_calendar` (
  `semester_id` int NOT NULL,
  `timetable_path` varchar(512) DEFAULT NULL,
  `timetable_updated_at` varchar(64) DEFAULT NULL,
  `timetable_updated_by` varchar(64) DEFAULT NULL,
  `calendar_path` varchar(512) DEFAULT NULL,
  `calendar_updated_at` varchar(64) DEFAULT NULL,
  `calendar_updated_by` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`semester_id`),
  CONSTRAINT `academic_calendar_ibfk_1` FOREIGN KEY (`semester_id`) REFERENCES `academic_semesters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_calendar`
--

LOCK TABLES `academic_calendar` WRITE;
/*!40000 ALTER TABLE `academic_calendar` DISABLE KEYS */;
INSERT INTO `academic_calendar` VALUES (5,NULL,'2026-08-18 01:45:27','admin',NULL,'2026-08-18 01:45:35','admin');
/*!40000 ALTER TABLE `academic_calendar` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_holidays`
--

DROP TABLE IF EXISTS `academic_holidays`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_holidays` (
  `id` int NOT NULL AUTO_INCREMENT,
  `holiday_date` date NOT NULL,
  `holiday_name` varchar(255) NOT NULL,
  `semester_id` int DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` varchar(64) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_academic_holiday` (`holiday_date`,`semester_id`),
  KEY `semester_id` (`semester_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_academic_holidays_date` (`holiday_date`,`active`),
  CONSTRAINT `academic_holidays_ibfk_1` FOREIGN KEY (`semester_id`) REFERENCES `academic_semesters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `academic_holidays_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`username`) ON UPDATE CASCADE,
  CONSTRAINT `academic_holidays_chk_1` CHECK ((`active` in (0,1)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_holidays`
--

LOCK TABLES `academic_holidays` WRITE;
/*!40000 ALTER TABLE `academic_holidays` DISABLE KEYS */;
/*!40000 ALTER TABLE `academic_holidays` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `academic_semesters`
--

DROP TABLE IF EXISTS `academic_semesters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `academic_semesters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `sort_order` int NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `sort_order` (`sort_order`),
  CONSTRAINT `academic_semesters_chk_1` CHECK ((`active` in (0,1)))
) ENGINE=InnoDB AUTO_INCREMENT=865 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `academic_semesters`
--

LOCK TABLES `academic_semesters` WRITE;
/*!40000 ALTER TABLE `academic_semesters` DISABLE KEYS */;
INSERT INTO `academic_semesters` VALUES (1,'I-I','I Year - I Semester',1,0),(2,'I-II','I Year - II Semester',2,0),(3,'II-I','II Year - I Semester',3,1),(4,'II-II','II Year - II Semester',4,1),(5,'III-I','III Year - I Semester',5,1),(6,'III-II','III Year - II Semester',6,1),(7,'IV-I','IV Year - I Semester',7,1),(8,'IV-II','IV Year - II Semester',8,1);
/*!40000 ALTER TABLE `academic_semesters` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance`
--

DROP TABLE IF EXISTS `attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `roll_no` varchar(64) NOT NULL,
  `date` varchar(32) NOT NULL,
  `department` varchar(64) NOT NULL DEFAULT 'CSD',
  `status` varchar(32) NOT NULL,
  `marked_by` varchar(64) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roll_no` (`roll_no`,`date`),
  KEY `idx_attendance_date` (`date`),
  KEY `idx_attendance_date_roll` (`date`,`roll_no`),
  KEY `idx_attendance_roll` (`roll_no`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`roll_no`) REFERENCES `students` (`roll_no`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `attendance_chk_1` CHECK ((`status` in (_utf8mb4'Present',_utf8mb4'Absent',_utf8mb4'Late',_utf8mb4'Excused')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance`
--

LOCK TABLES `attendance` WRITE;
/*!40000 ALTER TABLE `attendance` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_records`
--

DROP TABLE IF EXISTS `attendance_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` int NOT NULL,
  `roll_no` varchar(64) NOT NULL,
  `status` varchar(32) NOT NULL,
  `marked_by` varchar(64) NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_id` (`session_id`,`roll_no`),
  KEY `idx_attendance_records_session` (`session_id`),
  KEY `idx_attendance_records_roll` (`roll_no`),
  CONSTRAINT `attendance_records_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_records_ibfk_2` FOREIGN KEY (`roll_no`) REFERENCES `students` (`roll_no`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `attendance_records_chk_1` CHECK ((`status` in (_utf8mb4'Present',_utf8mb4'Absent')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_records`
--

LOCK TABLES `attendance_records` WRITE;
/*!40000 ALTER TABLE `attendance_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_sessions`
--

DROP TABLE IF EXISTS `attendance_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `attendance_date` varchar(32) NOT NULL,
  `semester_id` int NOT NULL,
  `subject_id` int NOT NULL,
  `faculty_username` varchar(64) NOT NULL,
  `session_type` varchar(32) NOT NULL,
  `duration_hours` int NOT NULL,
  `topic` text NOT NULL,
  `created_by` varchar(64) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `hod_username` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `attendance_date` (`attendance_date`,`subject_id`,`faculty_username`,`session_type`),
  KEY `semester_id` (`semester_id`),
  KEY `faculty_username` (`faculty_username`),
  KEY `idx_attendance_sessions_date` (`attendance_date`),
  KEY `idx_attendance_sessions_subject` (`subject_id`),
  KEY `idx_attendance_sessions_hod` (`hod_username`),
  CONSTRAINT `attendance_sessions_ibfk_1` FOREIGN KEY (`semester_id`) REFERENCES `academic_semesters` (`id`),
  CONSTRAINT `attendance_sessions_ibfk_2` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`),
  CONSTRAINT `attendance_sessions_ibfk_3` FOREIGN KEY (`faculty_username`) REFERENCES `users` (`username`) ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_sessions_hod` FOREIGN KEY (`hod_username`) REFERENCES `users` (`username`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `attendance_sessions_chk_1` CHECK ((`session_type` in (_utf8mb4'CLASS',_utf8mb4'LAB'))),
  CONSTRAINT `attendance_sessions_chk_2` CHECK ((`duration_hours` in (1,2,3)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_sessions`
--

LOCK TABLES `attendance_sessions` WRITE;
/*!40000 ALTER TABLE `attendance_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(64) NOT NULL,
  `action` varchar(64) NOT NULL,
  `entity` varchar(64) NOT NULL,
  `details` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=930 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,'admin','LOGIN','session','HOD','2026-08-14 01:18:46'),(2,'admin','LOGOUT','session','','2026-08-14 01:19:15'),(3,'memeistaan206@gmail.com','REQUEST_OTP','register','memeistaan206@gmail.com','2026-08-14 01:21:02'),(4,'memeistaan206@gmail.com','VERIFY_OTP','register','memeistaan206@gmail.com','2026-08-14 01:21:26'),(5,'student_1','SELF_REGISTER_NEW_STUDENT','student','24BT!A6766 (Test student) — open registration, verified email','2026-08-14 01:21:28'),(6,'student_1','SELF_REGISTER','student_login','24BT!A6766','2026-08-14 01:21:29'),(7,'student_1','LOGIN','session','STUDENT','2026-08-14 01:21:39'),(8,'student_1','LOGOUT','session','','2026-08-14 01:21:48'),(9,'admin','LOGIN','session','HOD','2026-08-14 01:22:01'),(10,'admin','UPLOAD','academic_calendar','III-I (timetable)','2026-08-14 01:22:17'),(11,'admin','UPLOAD','academic_calendar','III-I (calendar)','2026-08-14 01:22:22'),(12,'admin','LOGOUT','session','','2026-08-14 01:22:26'),(13,'student_1','LOGIN','session','STUDENT','2026-08-14 01:22:30'),(14,'student_1','LOGOUT','session','','2026-08-14 01:22:49'),(15,'admin','LOGIN','session','HOD','2026-08-14 01:22:54'),(16,'admin','DELETE','user','faculty1','2026-08-14 01:23:05'),(17,'admin','DELETE','user','faculty2','2026-08-14 01:23:09'),(18,'student_1','LOGIN','session','STUDENT','2026-08-14 01:24:00'),(19,'student_1','LOGOUT','session','','2026-08-14 01:24:15'),(20,'admin','DELETE','user','faculty_csd','2026-08-14 01:24:29'),(21,'admin','CREATE','user','test_faculty (FACULTY)','2026-08-14 01:34:28'),(22,'admin','LOGIN','session','HOD','2026-08-14 01:45:51'),(23,'admin','LOGIN','session','HOD','2026-08-14 01:45:51'),(24,'admin','LOGIN','session','HOD','2026-08-14 01:45:51'),(25,'admin','CREATE','student','zzqae845eec0_R001','2026-08-14 01:45:52'),(26,'admin','CREATE','student_login','zzqae845eec0_R001','2026-08-14 01:45:52'),(27,'admin','UPDATE','student','zzqae845eec0_R001','2026-08-14 01:45:52'),(28,'admin','STATUS','student','zzqae845eec0_R001 -> 0','2026-08-14 01:45:52'),(29,'admin','DELETE','student','zzqae845eec0_R001','2026-08-14 01:45:53'),(30,'admin','CREATE','attendance_session','session=1; subject=4; type=LAB; hours=3','2026-08-14 01:45:53'),(31,'admin','CREATE','subject','ZZQAE845EEC0DUP - ZZQA Duplicate Probe (semester=1)','2026-08-14 01:45:54'),(32,'admin','UPDATE_PROBLEM_REPORT','report','ID 999999999 -> RESOLVED','2026-08-14 01:45:54'),(33,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 01:45:55'),(34,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 01:45:55'),(35,'admin','LOGIN','session','HOD','2026-08-14 01:49:25'),(36,'admin','LOGIN','session','HOD','2026-08-14 01:49:25'),(37,'admin','LOGIN','session','HOD','2026-08-14 01:49:25'),(38,'admin','CREATE','student','zzqa13a42c7f_R001','2026-08-14 01:49:26'),(39,'admin','CREATE','student_login','zzqa13a42c7f_R001','2026-08-14 01:49:26'),(40,'admin','UPDATE','student','zzqa13a42c7f_R001','2026-08-14 01:49:26'),(41,'admin','STATUS','student','zzqa13a42c7f_R001 -> 0','2026-08-14 01:49:26'),(42,'admin','DELETE','student','zzqa13a42c7f_R001','2026-08-14 01:49:26'),(43,'admin','CREATE','attendance_session','session=2; subject=40; type=LAB; hours=3','2026-08-14 01:49:27'),(44,'admin','CREATE','subject','ZZQA13A42C7FDUP - ZZQA Duplicate Probe (semester=1)','2026-08-14 01:49:28'),(45,'admin','UPDATE_PROBLEM_REPORT','report','ID 999999999 -> RESOLVED','2026-08-14 01:49:28'),(46,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 01:49:29'),(47,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 01:49:29'),(48,'admin','LOGIN','session','HOD','2026-08-14 02:03:02'),(49,'admin','LOGIN','session','HOD','2026-08-14 02:03:02'),(50,'admin','LOGIN','session','HOD','2026-08-14 02:03:02'),(51,'admin','CREATE','student','zzqaff9bef25_R001','2026-08-14 02:03:03'),(52,'admin','CREATE','student_login','zzqaff9bef25_R001','2026-08-14 02:03:03'),(53,'admin','UPDATE','student','zzqaff9bef25_R001','2026-08-14 02:03:03'),(54,'admin','STATUS','student','zzqaff9bef25_R001 -> 0','2026-08-14 02:03:03'),(55,'admin','DELETE','student','zzqaff9bef25_R001','2026-08-14 02:03:03'),(56,'admin','CREATE','attendance_session','session=3; subject=54; type=LAB; hours=3','2026-08-14 02:03:03'),(57,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 02:03:04'),(58,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 02:03:04'),(59,'admin','CREATE','subject','ZZQAFF9BEF25DUP - ZZQA Duplicate Probe (semester=1)','2026-08-14 02:03:04'),(60,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 02:03:05'),(61,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 02:03:05'),(62,'admin','LOGIN','session','HOD','2026-08-14 02:08:21'),(63,'admin','LOGIN','session','HOD','2026-08-14 02:08:21'),(64,'admin','LOGIN','session','HOD','2026-08-14 02:08:21'),(65,'admin','CREATE','student','zzqaf62aa8b5_R001','2026-08-14 02:08:22'),(66,'admin','CREATE','student_login','zzqaf62aa8b5_R001','2026-08-14 02:08:22'),(67,'admin','UPDATE','student','zzqaf62aa8b5_R001','2026-08-14 02:08:22'),(68,'admin','STATUS','student','zzqaf62aa8b5_R001 -> 0','2026-08-14 02:08:22'),(69,'admin','DELETE','student','zzqaf62aa8b5_R001','2026-08-14 02:08:22'),(70,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 02:08:23'),(71,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 02:08:23'),(72,'admin','CREATE','subject','ZZQAF62AA8B5DUP - ZZQA Duplicate Probe (semester=1)','2026-08-14 02:08:23'),(73,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 02:08:24'),(74,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 02:08:24'),(75,'admin','LOGIN','session','HOD','2026-08-14 02:28:28'),(76,'admin','LOGIN','session','HOD','2026-08-14 02:28:28'),(77,'admin','LOGIN','session','HOD','2026-08-14 02:28:28'),(78,'admin','CREATE','student','zzqa89831864_R001','2026-08-14 02:28:29'),(79,'admin','CREATE','student_login','zzqa89831864_R001','2026-08-14 02:28:29'),(80,'admin','UPDATE','student','zzqa89831864_R001','2026-08-14 02:28:29'),(81,'admin','STATUS','student','zzqa89831864_R001 -> 0','2026-08-14 02:28:29'),(82,'admin','DELETE','student','zzqa89831864_R001','2026-08-14 02:28:29'),(83,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 02:28:30'),(84,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 02:28:30'),(85,'admin','CREATE','subject','ZZQA89831864DUP - ZZQA Duplicate Probe (semester=1)','2026-08-14 02:28:30'),(86,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 02:28:31'),(87,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 02:28:31'),(88,'admin','LOGIN','session','HOD','2026-08-14 02:44:04'),(89,'admin','LOGIN','session','HOD','2026-08-14 02:44:04'),(90,'admin','LOGIN','session','HOD','2026-08-14 02:44:05'),(91,'admin','CREATE','student','zzqabc36ed16_R001','2026-08-14 02:44:05'),(92,'admin','CREATE','student_login','zzqabc36ed16_R001','2026-08-14 02:44:05'),(93,'admin','UPDATE','student','zzqabc36ed16_R001','2026-08-14 02:44:05'),(94,'admin','STATUS','student','zzqabc36ed16_R001 -> 0','2026-08-14 02:44:06'),(95,'admin','DELETE','student','zzqabc36ed16_R001','2026-08-14 02:44:06'),(96,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 02:44:06'),(97,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 02:44:06'),(98,'admin','CREATE','subject','ZZQABC36ED16DUP - ZZQA Duplicate Probe (semester=1)','2026-08-14 02:44:07'),(99,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 02:44:07'),(100,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 02:44:07'),(101,'admin','LOGIN','session','HOD','2026-08-14 02:48:33'),(102,'admin','LOGIN','session','HOD','2026-08-14 02:48:33'),(103,'admin','LOGIN','session','HOD','2026-08-14 02:48:34'),(104,'admin','LOGIN','session','HOD','2026-08-14 02:48:34'),(105,'admin','LOGOUT','session','','2026-08-14 02:48:34'),(106,'student_1','LOGIN','session','STUDENT','2026-08-14 02:48:34'),(107,'test_faculty','LOGIN','session','FACULTY','2026-08-14 02:48:34'),(108,'admin','CREATE','student','zzqa0d5d5158_R001','2026-08-14 02:48:35'),(109,'admin','CREATE','student_login','zzqa0d5d5158_R001','2026-08-14 02:48:35'),(110,'admin','UPDATE','student','zzqa0d5d5158_R001','2026-08-14 02:48:35'),(111,'admin','STATUS','student','zzqa0d5d5158_R001 -> 0','2026-08-14 02:48:35'),(112,'admin','DELETE','student','zzqa0d5d5158_R001','2026-08-14 02:48:35'),(113,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 02:48:35'),(114,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 02:48:36'),(115,'admin','LOGIN','session','HOD','2026-08-14 02:48:36'),(116,'admin','CREATE','subject','ZZQA0D5D5158DUP - ZZQA Duplicate Probe (semester=1)','2026-08-14 02:48:36'),(117,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA automated test report zzqa0d5d5158','2026-08-14 02:48:36'),(118,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA lifecycle probe zzqa0d5d5158','2026-08-14 02:48:36'),(119,'admin','LOGIN','session','HOD','2026-08-14 02:52:54'),(120,'admin','LOGIN','session','HOD','2026-08-14 02:52:54'),(121,'admin','LOGIN','session','HOD','2026-08-14 02:52:54'),(122,'admin','LOGIN','session','HOD','2026-08-14 02:52:55'),(123,'admin','LOGOUT','session','','2026-08-14 02:52:55'),(124,'student_1','LOGIN','session','STUDENT','2026-08-14 02:52:55'),(125,'test_faculty','LOGIN','session','FACULTY','2026-08-14 02:52:55'),(126,'admin','CREATE','student','zzqa1e90d7ee_R001','2026-08-14 02:52:55'),(127,'admin','CREATE','student_login','zzqa1e90d7ee_R001','2026-08-14 02:52:55'),(128,'admin','UPDATE','student','zzqa1e90d7ee_R001','2026-08-14 02:52:55'),(129,'admin','STATUS','student','zzqa1e90d7ee_R001 -> 0','2026-08-14 02:52:56'),(130,'admin','DELETE','student','zzqa1e90d7ee_R001','2026-08-14 02:52:56'),(131,'admin','CREATE','attendance_session','session=4; subject=154; type=LAB; hours=3','2026-08-14 02:52:56'),(132,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 02:52:56'),(133,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 02:52:56'),(134,'admin','LOGIN','session','HOD','2026-08-14 02:52:57'),(135,'admin','CREATE','subject','ZZQA1E90D7EEDUP - ZZQA Duplicate Probe (semester=1)','2026-08-14 02:52:57'),(136,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA automated test report zzqa1e90d7ee','2026-08-14 02:52:57'),(137,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA lifecycle probe zzqa1e90d7ee','2026-08-14 02:52:57'),(138,'admin','UPDATE_PROBLEM_REPORT','report','ID 4 -> RESOLVED','2026-08-14 02:52:57'),(139,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 02:52:57'),(140,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 02:52:58'),(141,'student_1','UPDATE','student','24BT!A6766 (self-edit)','2026-08-14 02:52:58'),(142,'admin','LOGIN','session','HOD','2026-08-14 02:59:41'),(143,'admin','LOGIN','session','HOD','2026-08-14 02:59:41'),(144,'admin','LOGIN','session','HOD','2026-08-14 02:59:41'),(145,'admin','LOGIN','session','HOD','2026-08-14 02:59:41'),(146,'admin','LOGOUT','session','','2026-08-14 02:59:42'),(147,'student_1','LOGIN','session','STUDENT','2026-08-14 02:59:42'),(148,'test_faculty','LOGIN','session','FACULTY','2026-08-14 02:59:42'),(149,'admin','CREATE','student','zzqa13bb73b6_R001','2026-08-14 02:59:42'),(150,'admin','CREATE','student_login','zzqa13bb73b6_R001','2026-08-14 02:59:42'),(151,'admin','UPDATE','student','zzqa13bb73b6_R001','2026-08-14 02:59:43'),(152,'admin','STATUS','student','zzqa13bb73b6_R001 -> 0','2026-08-14 02:59:43'),(153,'admin','DELETE','student','zzqa13bb73b6_R001','2026-08-14 02:59:43'),(154,'admin','CREATE','attendance_session','session=5; subject=154; type=CLASS; hours=1','2026-08-14 02:59:43'),(155,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 02:59:43'),(156,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 02:59:43'),(157,'admin','LOGIN','session','HOD','2026-08-14 02:59:44'),(158,'admin','CREATE','subject','ZZQA13BB73B6DUP - ZZQA Duplicate Probe (semester=1)','2026-08-14 02:59:44'),(159,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA automated test report zzqa13bb73b6','2026-08-14 02:59:44'),(160,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA lifecycle probe zzqa13bb73b6','2026-08-14 02:59:44'),(161,'admin','UPDATE_PROBLEM_REPORT','report','ID 6 -> RESOLVED','2026-08-14 02:59:44'),(162,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 02:59:45'),(163,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 02:59:45'),(164,'student_1','UPDATE','student','24BT!A6766 (self-edit)','2026-08-14 02:59:45'),(165,'admin','LOGIN','session','HOD','2026-08-14 03:05:19'),(166,'admin','LOGIN','session','HOD','2026-08-14 03:05:19'),(167,'admin','LOGIN','session','HOD','2026-08-14 03:05:19'),(168,'admin','LOGIN','session','HOD','2026-08-14 03:05:20'),(169,'admin','LOGOUT','session','','2026-08-14 03:05:20'),(170,'student_1','LOGIN','session','STUDENT','2026-08-14 03:05:20'),(171,'test_faculty','LOGIN','session','FACULTY','2026-08-14 03:05:20'),(172,'admin','CREATE','student','zzqa85c924c7_R001','2026-08-14 03:05:20'),(173,'admin','CREATE','student_login','zzqa85c924c7_R001','2026-08-14 03:05:20'),(174,'admin','UPDATE','student','zzqa85c924c7_R001','2026-08-14 03:05:21'),(175,'admin','STATUS','student','zzqa85c924c7_R001 -> 0','2026-08-14 03:05:21'),(176,'admin','DELETE','student','zzqa85c924c7_R001','2026-08-14 03:05:21'),(177,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 03:05:21'),(178,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 03:05:21'),(179,'admin','LOGIN','session','HOD','2026-08-14 03:05:22'),(180,'admin','CREATE','subject','ZZQA85C924C7DUP - ZZQA Duplicate Probe (semester=1)','2026-08-14 03:05:22'),(181,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA automated test report zzqa85c924c7','2026-08-14 03:05:22'),(182,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA lifecycle probe zzqa85c924c7','2026-08-14 03:05:22'),(183,'admin','UPDATE_PROBLEM_REPORT','report','ID 8 -> RESOLVED','2026-08-14 03:05:22'),(184,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 03:05:23'),(185,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 03:05:23'),(186,'student_1','UPDATE','student','24BT!A6766 (self-edit)','2026-08-14 03:05:23'),(187,'admin','LOGIN','session','HOD','2026-08-14 03:08:22'),(188,'admin','LOGIN','session','HOD','2026-08-14 03:08:22'),(189,'admin','LOGIN','session','HOD','2026-08-14 03:08:22'),(190,'admin','LOGIN','session','HOD','2026-08-14 03:08:23'),(191,'admin','LOGOUT','session','','2026-08-14 03:08:23'),(192,'student_1','LOGIN','session','STUDENT','2026-08-14 03:08:23'),(193,'test_faculty','LOGIN','session','FACULTY','2026-08-14 03:08:23'),(194,'admin','CREATE','student','zzqa7d1eac1d_R001','2026-08-14 03:08:23'),(195,'admin','CREATE','student_login','zzqa7d1eac1d_R001','2026-08-14 03:08:23'),(196,'admin','UPDATE','student','zzqa7d1eac1d_R001','2026-08-14 03:08:24'),(197,'admin','STATUS','student','zzqa7d1eac1d_R001 -> 0','2026-08-14 03:08:24'),(198,'admin','DELETE','student','zzqa7d1eac1d_R001','2026-08-14 03:08:24'),(199,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 03:08:24'),(200,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 03:08:25'),(201,'admin','LOGIN','session','HOD','2026-08-14 03:08:25'),(202,'admin','CREATE','subject','ZZQA7D1EAC1DDUP - ZZQA Duplicate Probe (semester=1)','2026-08-14 03:08:25'),(203,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA automated test report zzqa7d1eac1d','2026-08-14 03:08:25'),(204,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA lifecycle probe zzqa7d1eac1d','2026-08-14 03:08:25'),(205,'admin','UPDATE_PROBLEM_REPORT','report','ID 10 -> RESOLVED','2026-08-14 03:08:25'),(206,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 03:08:26'),(207,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 03:08:26'),(208,'student_1','UPDATE','student','24BT!A6766 (self-edit)','2026-08-14 03:08:26'),(209,'admin','LOGIN','session','HOD','2026-08-14 03:09:34'),(210,'admin','LOGIN','session','HOD','2026-08-14 03:09:35'),(211,'admin','LOGIN','session','HOD','2026-08-14 03:09:35'),(212,'admin','LOGIN','session','HOD','2026-08-14 03:09:35'),(213,'admin','LOGOUT','session','','2026-08-14 03:09:35'),(214,'student_1','LOGIN','session','STUDENT','2026-08-14 03:09:36'),(215,'test_faculty','LOGIN','session','FACULTY','2026-08-14 03:09:36'),(216,'admin','CREATE','student','zzqac2877181_R001','2026-08-14 03:09:36'),(217,'admin','CREATE','student_login','zzqac2877181_R001','2026-08-14 03:09:36'),(218,'admin','UPDATE','student','zzqac2877181_R001','2026-08-14 03:09:36'),(219,'admin','STATUS','student','zzqac2877181_R001 -> 0','2026-08-14 03:09:36'),(220,'admin','DELETE','student','zzqac2877181_R001','2026-08-14 03:09:36'),(221,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 03:09:37'),(222,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 03:09:37'),(223,'admin','LOGIN','session','HOD','2026-08-14 03:09:37'),(224,'admin','CREATE','subject','ZZQAC2877181DUP - ZZQA Duplicate Probe (semester=1)','2026-08-14 03:09:37'),(225,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA automated test report zzqac2877181','2026-08-14 03:09:38'),(226,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA lifecycle probe zzqac2877181','2026-08-14 03:09:38'),(227,'admin','UPDATE_PROBLEM_REPORT','report','ID 12 -> RESOLVED','2026-08-14 03:09:38'),(228,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 03:09:38'),(229,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 03:09:38'),(230,'student_1','UPDATE','student','24BT!A6766 (self-edit)','2026-08-14 03:09:38'),(231,'admin','LOGIN','session','HOD','2026-08-14 03:10:23'),(232,'admin','LOGIN','session','HOD','2026-08-14 03:10:23'),(233,'admin','LOGIN','session','HOD','2026-08-14 03:10:23'),(234,'admin','LOGIN','session','HOD','2026-08-14 03:10:24'),(235,'admin','LOGOUT','session','','2026-08-14 03:10:24'),(236,'student_1','LOGIN','session','STUDENT','2026-08-14 03:10:24'),(237,'test_faculty','LOGIN','session','FACULTY','2026-08-14 03:10:24'),(238,'admin','CREATE','student','zzqa813ef878_R001','2026-08-14 03:10:24'),(239,'admin','CREATE','student_login','zzqa813ef878_R001','2026-08-14 03:10:24'),(240,'admin','UPDATE','student','zzqa813ef878_R001','2026-08-14 03:10:24'),(241,'admin','STATUS','student','zzqa813ef878_R001 -> 0','2026-08-14 03:10:24'),(242,'admin','DELETE','student','zzqa813ef878_R001','2026-08-14 03:10:25'),(243,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 03:10:25'),(244,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-14 03:10:25'),(245,'admin','LOGIN','session','HOD','2026-08-14 03:10:25'),(246,'admin','CREATE','subject','ZZQA813EF878DUP - ZZQA Duplicate Probe (semester=1)','2026-08-14 03:10:25'),(247,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA automated test report zzqa813ef878','2026-08-14 03:10:26'),(248,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA lifecycle probe zzqa813ef878','2026-08-14 03:10:26'),(249,'admin','UPDATE_PROBLEM_REPORT','report','ID 14 -> RESOLVED','2026-08-14 03:10:26'),(250,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 03:10:26'),(251,'admin','UPDATE','user','admin (self-edit profile)','2026-08-14 03:10:26'),(252,'student_1','UPDATE','student','24BT!A6766 (self-edit)','2026-08-14 03:10:26'),(253,'admin','CREATE','user','newtester (FACULTY)','2026-08-14 03:22:32'),(254,'admin','LOGIN','session','HOD','2026-08-18 01:29:57'),(255,'admin','LOGIN','session','HOD','2026-08-18 01:34:26'),(256,'admin','DELETE','user','test_faculty','2026-08-18 01:34:40'),(257,'admin','LOGIN','session','HOD','2026-08-18 01:35:29'),(258,'admin','DELETE','user','newtester','2026-08-18 01:41:50'),(259,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-18 01:42:10'),(260,'kiranpulusu86@gmail.com','REQUEST_OTP','register','kiranpulusu86@gmail.com','2026-08-18 01:43:07'),(261,'kiranpulusu86@gmail.com','VERIFY_OTP','register','kiranpulusu86@gmail.com','2026-08-18 01:43:53'),(262,'Kiran','SELF_REGISTER_NEW_STUDENT','student','24bt1a6746 (PULUSU KIRAN) — open registration, verified email','2026-08-18 01:44:19'),(263,'Kiran','SELF_REGISTER','student_login','24bt1a6746','2026-08-18 01:44:19'),(264,'Kiran','LOGIN','session','STUDENT','2026-08-18 01:44:50'),(265,'admin','DELETE_UPLOAD','academic_calendar','III-I (timetable)','2026-08-18 01:45:27'),(266,'admin','DELETE_UPLOAD','academic_calendar','III-I (calendar)','2026-08-18 01:45:35'),(267,'Kiran','UPDATE','student','24bt1a6746 (self-edit)','2026-08-18 01:50:30'),(268,'admin','LOGIN','session','HOD','2026-08-18 01:51:39'),(269,'admin','DELETE','user','faculty2','2026-08-18 01:51:56'),(270,'admin','DELETE','user','faculty_csd','2026-08-18 01:52:01'),(271,'admin','LOGOUT','session','','2026-08-18 01:52:07'),(272,'admin','CREATE','user','mani (FACULTY)','2026-08-18 01:59:59'),(273,'admin','DELETE','user','mani','2026-08-18 02:00:15'),(274,'admin','LOGIN','session','HOD','2026-08-18 02:18:28'),(275,'admin','UPDATE','sms_gateway','gateway=1; hod=admin','2026-08-18 02:19:33'),(276,'admin','UPDATE','sms_gateway','gateway=1; hod=admin','2026-08-18 02:19:45'),(277,'admin','LOGOUT','session','','2026-08-18 02:20:11'),(278,'admin','LOGIN','session','HOD','2026-08-18 02:20:52'),(279,'admin','LOGOUT','session','','2026-08-18 02:22:02'),(280,'Naveen','LOGIN','session','FACULTY','2026-08-18 02:22:21'),(281,'Naveen','LOGOUT','session','','2026-08-18 02:22:58'),(282,'Naveen','LOGOUT','session','','2026-08-18 02:22:58'),(283,'admin','LOGIN','session','HOD','2026-08-18 02:23:03'),(284,'admin','UPDATE','subject_faculty','24CS503PC: faculty=[Naveen]','2026-08-18 02:23:28'),(285,'Naveen','LOGIN','session','FACULTY','2026-08-18 02:24:04'),(286,'chowdharykishan67@gmail.com','REQUEST_OTP','register','chowdharykishan67@gmail.com','2026-08-18 02:24:43'),(287,'admin','UPDATE_USER_PERMISSIONS','user','Naveen','2026-08-18 02:25:03'),(288,'chowdharykishan67@gmail.com','VERIFY_OTP','register','chowdharykishan67@gmail.com','2026-08-18 02:25:18'),(289,'Kishu__chowdhary','SELF_REGISTER_NEW_STUDENT','student','24BT1A6712 (Chowdhary kishan) — open registration, verified email','2026-08-18 02:25:19'),(290,'Kishu__chowdhary','SELF_REGISTER','student_login','24BT1A6712','2026-08-18 02:25:20'),(291,'Kishu__chowdhary','LOGIN','session','STUDENT','2026-08-18 02:25:33'),(292,'Kishu__chowdhary','PHOTO','student','24BT1A6712 (self-upload)','2026-08-18 02:26:33'),(293,'admin','CREATE','user','Newfaculty (FACULTY)','2026-08-18 02:26:34'),(294,'Naveen','LOGOUT','session','','2026-08-18 02:27:01'),(295,'Newfaculty','LOGIN','session','FACULTY','2026-08-18 02:27:15'),(296,'Kishu__chowdhary','UPDATE','student','24BT1A6712 (self-edit)','2026-08-18 02:27:34'),(297,'admin','UPDATE','subject_faculty','24MC510: faculty=[Newfaculty]','2026-08-18 02:27:47'),(298,'Newfaculty','CREATE','attendance_session','session=6; subject=12; type=CLASS; hours=1','2026-08-18 02:28:04'),(299,'Newfaculty','SAVE','attendance_session','session=6; type=CLASS; hours=1; present=1; absent=2','2026-08-18 02:28:14'),(300,'Newfaculty','SMS_QUEUED','attendance_session','session=6; queued=2; skipped_no_phone=0; hod=admin','2026-08-18 02:28:14'),(301,'Kishu__chowdhary','PHOTO_DELETE','student','24BT1A6712 (self-delete)','2026-08-18 02:28:16'),(302,'admin','SMS_BATCH_APPROVED','sms_queue','hod=admin; date=2026-08-18; count=2','2026-08-18 02:28:28'),(303,'Kishu__chowdhary','PHOTO','student','24BT1A6712 (self-upload)','2026-08-18 02:28:31'),(304,'admin','UPDATE','sms_gateway','gateway=1; hod=admin','2026-08-18 02:33:24'),(305,'admin','UPDATE','settings','sms_enabled=1','2026-08-18 02:33:30'),(306,'admin','UPDATE','settings','sms_daily_cap=62','2026-08-18 02:33:30'),(307,'Newfaculty','SAVE','attendance_session','session=6; type=CLASS; hours=1; present=1; absent=2','2026-08-18 02:34:14'),(308,'system','SMS_FAILED','student','24BT1A6712: SMSGate Cloud HTTP 401: {\'message\': \'Unauthorized\'}','2026-08-18 02:39:44'),(309,'system','SMS_FAILED','student','24bt1a6746: SMSGate Cloud HTTP 401: {\'message\': \'Unauthorized\'}','2026-08-18 02:39:44'),(310,'admin','LOGIN','session','HOD','2026-08-18 02:40:54'),(311,'student_1','LOGIN','session','STUDENT','2026-08-18 02:40:55'),(312,'admin','UPDATE','user','admin (self-edit profile)','2026-08-18 02:40:55'),(313,'admin','UPDATE','user','admin (self-edit profile)','2026-08-18 02:40:55'),(314,'student_1','UPDATE','student','24BT!A6766 (self-edit)','2026-08-18 02:40:55'),(315,'Newfaculty','SAVE','attendance_session','session=6; type=CLASS; hours=1; present=1; absent=2','2026-08-18 02:43:05'),(316,'Newfaculty','SAVE','attendance_session','session=6; type=CLASS; hours=1; present=1; absent=2','2026-08-18 02:43:26'),(317,'Newfaculty','SAVE','attendance_session','session=6; type=CLASS; hours=1; present=2; absent=1','2026-08-18 02:43:46'),(318,'admin','UPDATE','sms_gateway','gateway=1; hod=admin','2026-08-18 02:44:28'),(319,'thirumala7240@gmail.com','REQUEST_OTP','register','thirumala7240@gmail.com','2026-08-18 02:45:46'),(320,'thirumala7240@gmail.com','VERIFY_OTP','register','thirumala7240@gmail.com','2026-08-18 02:46:37'),(321,'Thirumala','SELF_REGISTER_NEW_STUDENT','student','24BT1A6722 (G Thirumala) — open registration, verified email','2026-08-18 02:46:39'),(322,'Thirumala','SELF_REGISTER','student_login','24BT1A6722','2026-08-18 02:46:39'),(323,'Thirumala','LOGIN','session','STUDENT','2026-08-18 02:46:58'),(324,'Newfaculty','SAVE','attendance_session','session=6; type=CLASS; hours=1; present=2; absent=2','2026-08-18 02:47:13'),(325,'Newfaculty','SAVE','attendance_session','session=6; type=CLASS; hours=1; present=2; absent=2','2026-08-18 02:56:45'),(326,'Newfaculty','SAVE','attendance_session','session=6; type=CLASS; hours=1; present=2; absent=2','2026-08-18 02:56:46'),(327,'Newfaculty','SAVE','attendance_session','session=6; type=CLASS; hours=1; present=1; absent=3','2026-08-18 02:57:26'),(328,'admin','UPDATE','sms_gateway','gateway=1; hod=admin','2026-08-18 02:57:36'),(329,'Newfaculty','SAVE','attendance_session','session=6; type=CLASS; hours=1; present=1; absent=3','2026-08-18 02:57:41'),(330,'Naveen','LOGIN','session','FACULTY','2026-08-18 02:58:43'),(331,'admin','CREATE','user','facultytester (FACULTY)','2026-08-18 02:59:48'),(332,'Naveen','LOGOUT','session','','2026-08-18 03:00:10'),(333,'admin','LOGOUT','session','','2026-08-18 03:00:30'),(334,'facultytester','LOGIN','session','FACULTY','2026-08-18 03:00:42'),(335,'admin','LOGIN','session','HOD','2026-08-18 03:00:57'),(336,'admin','UPDATE','subject_faculty','CSD223: faculty=[facultytester]','2026-08-18 03:01:21'),(337,'admin','UPDATE','subject_faculty','CSD223: faculty=[faculty1]','2026-08-18 03:01:58'),(338,'admin','UPDATE','subject_faculty','24CS512PE: faculty=[facultytester]','2026-08-18 03:02:12'),(339,'facultytester','CREATE','attendance_session','session=7; subject=11; type=CLASS; hours=1','2026-08-18 03:02:22'),(340,'facultytester','SAVE','attendance_session','session=7; type=CLASS; hours=1; present=2; absent=2','2026-08-18 03:02:28'),(341,'Thirumala','LOGIN','session','STUDENT','2026-08-18 03:33:23'),(342,'Thirumala','LOGOUT','session','','2026-08-18 03:33:42'),(343,'admin','LOGIN','session','HOD','2026-08-18 03:33:51'),(344,'Naveen','LOGIN','session','FACULTY','2026-08-18 03:35:18'),(345,'Naveen','LOGOUT','session','','2026-08-18 03:35:36'),(346,'Naveen','LOGOUT','session','','2026-08-18 03:35:36'),(347,'facultytester','LOGIN','session','FACULTY','2026-08-18 03:36:06'),(348,'facultytester','SAVE','attendance_session','session=7; type=CLASS; hours=1; present=1; absent=3','2026-08-18 03:36:23'),(349,'facultytester','SMS_BLOCKED','sms_queue','roll=24BT1A6722; Parent phone number is missing for this student.','2026-08-18 03:36:23'),(350,'facultytester','SMS_QUEUED','attendance_session','session=7; queued=0; blocked=1; duplicate=2; no_phone=0; cap_blocked=0; repeat_mode=1; hod=admin','2026-08-18 03:36:23'),(351,'facultytester','SAVE','attendance_session','session=7; type=CLASS; hours=1; present=1; absent=3','2026-08-18 03:36:31'),(352,'admin','UPDATE','student','24BT1A6722','2026-08-18 03:37:51'),(353,'admin','SMS_BATCH_APPROVED','sms_queue','hod=admin; date=2026-08-18; count=1','2026-08-18 03:38:04'),(354,'system','SMS_SENT','student','24BT1A6722','2026-08-18 03:38:04'),(355,'shashankgoud356@gmail.com','REQUEST_OTP','register','shashankgoud356@gmail.com','2026-08-18 03:38:57'),(356,'shashankgoud356@gmail.com','VERIFY_OTP','register','shashankgoud356@gmail.com','2026-08-18 03:39:18'),(360,'Shashank1244','SELF_REGISTER_NEW_STUDENT','student','24BT1A6762 (Shashank) — open registration, verified email','2026-08-18 03:40:11'),(361,'Shashank1244','SELF_REGISTER','student_login','24BT1A6762','2026-08-18 03:40:12'),(362,'Shashank1244','LOGIN','session','STUDENT','2026-08-18 03:40:24'),(363,'Shashank1244','UPDATE','student','24BT1A6762 (self-edit)','2026-08-18 03:40:47'),(364,'facultytester','SAVE','attendance_session','session=7; type=CLASS; hours=1; present=1; absent=4','2026-08-18 03:41:01'),(365,'facultytester','SMS_QUEUED','attendance_session','session=7; queued=1; blocked=0; duplicate=3; no_phone=0; cap_blocked=0; repeat_mode=1; hod=admin','2026-08-18 03:41:01'),(366,'admin','SMS_BATCH_APPROVED','sms_queue','hod=admin; date=2026-08-18; count=1','2026-08-18 03:41:12'),(367,'system','SMS_SENT','student','24BT1A6762','2026-08-18 03:41:14'),(368,'admin','LOGIN','session','HOD','2026-08-18 03:52:51'),(369,'facultytester','LOGIN','session','FACULTY','2026-08-18 03:54:17'),(370,'facultytester','CREATE','attendance_session','session=8; subject=11; type=CLASS; hours=1','2026-08-19 01:57:27'),(371,'admin','PHOTO','user','admin (self-upload)','2026-08-19 01:57:52'),(372,'facultytester','LOGOUT','session','','2026-08-19 01:57:52'),(373,'facultytester','LOGOUT','session','','2026-08-19 01:57:53'),(374,'admin','LOGIN','session','HOD','2026-08-19 01:58:13'),(375,'admin','SAVE','attendance_session','session=8; type=CLASS; hours=1; present=1; absent=4','2026-08-19 01:59:44'),(376,'admin','SMS_QUEUED','attendance_session','session=8; queued=4; blocked=0; duplicate=0; no_phone=0; cap_blocked=0; repeat_mode=1; hod=admin','2026-08-19 01:59:45'),(377,'admin','SMS_BATCH_APPROVED','sms_queue','hod=admin; date=2026-08-19; count=4','2026-08-19 02:00:03'),(378,'system','SMS_SENT','student','24BT1A6712','2026-08-19 02:00:05'),(379,'system','SMS_SENT','student','24BT1A6722','2026-08-19 02:00:06'),(380,'system','SMS_SENT','student','24bt1a6746','2026-08-19 02:00:06'),(381,'system','SMS_SENT','student','24BT1A6762','2026-08-19 02:00:07'),(382,'admin','SAVE','attendance_session','session=8; type=CLASS; hours=1; present=1; absent=4','2026-08-19 02:01:20'),(383,'akhilkumaranumula123@gmail.com','REQUEST_OTP','register','akhilkumaranumula123@gmail.com','2026-08-19 02:05:53'),(384,'akhilkumaranumula123@gmail.com','VERIFY_OTP','register','akhilkumaranumula123@gmail.com','2026-08-19 02:06:49'),(385,'Akhil@123','SELF_REGISTER_NEW_STUDENT','student','24BT1A6703 (Anumula Akhil Kumar) — open registration, verified email','2026-08-19 02:06:51'),(386,'Akhil@123','SELF_REGISTER','student_login','24BT1A6703','2026-08-19 02:06:51'),(387,'Akhil@123','LOGIN','session','STUDENT','2026-08-19 02:07:09'),(388,'Akhil@123','UPDATE','student','24BT1A6703 (self-edit)','2026-08-19 02:08:36'),(389,'Akhil@123','UPDATE','student','24BT1A6703 (self-edit)','2026-08-19 02:09:01'),(390,'maddiyashwanthreddy12@gmail.com','REQUEST_OTP','register','maddiyashwanthreddy12@gmail.com','2026-08-19 02:09:07'),(391,'maddiyashwanthreddy12@gmail.com','VERIFY_OTP','register','maddiyashwanthreddy12@gmail.com','2026-08-19 02:10:02'),(392,'Yashwanth Reddy','SELF_REGISTER_NEW_STUDENT','student','24BT1A6733 (Maddi Yashwanth Reddy) — open registration, verified email','2026-08-19 02:10:03'),(393,'Yashwanth Reddy','SELF_REGISTER','student_login','24BT1A6733','2026-08-19 02:10:03'),(394,'Yashwanth Reddy','LOGIN','session','STUDENT','2026-08-19 02:10:18'),(395,'Yashwanth Reddy','PHOTO','student','24BT1A6733 (self-upload)','2026-08-19 02:12:34'),(396,'Yashwanth Reddy','PHOTO','student','24BT1A6733 (self-upload)','2026-08-19 02:13:01'),(397,'admin','PHOTO','student','24BT1A6703','2026-08-19 02:14:59'),(398,'admin','PHOTO_DELETE','student','24BT1A6703','2026-08-19 02:15:18'),(399,'admin','DELETE','user','faculty2','2026-08-19 02:16:24'),(400,'Yashwanth Reddy','UPDATE','student','24BT1A6733 (self-edit)','2026-08-19 02:16:30'),(401,'Yashwanth Reddy','UPDATE','student','24BT1A6733 (self-edit)','2026-08-19 02:16:48'),(402,'Yashwanth Reddy','UPDATE','student','24BT1A6733 (self-edit)','2026-08-19 02:17:22'),(403,'admin','UPDATE','student','24BT1A6733','2026-08-19 02:17:28'),(404,'Yashwanth Reddy','UPDATE','student','24BT1A6733 (self-edit)','2026-08-19 02:17:45'),(405,'admin','UPDATE','student','24BT1A6733','2026-08-19 02:17:45'),(406,'Yashwanth Reddy','UPDATE','student','24BT1A6733 (self-edit)','2026-08-19 02:18:15'),(407,'admin','SAVE','attendance_session','session=8; type=CLASS; hours=1; present=2; absent=5','2026-08-19 02:20:08'),(408,'admin','SMS_QUEUED','attendance_session','session=8; queued=1; blocked=0; duplicate=4; no_phone=0; cap_blocked=0; repeat_mode=1; hod=admin','2026-08-19 02:20:08'),(409,'admin','SMS_BATCH_APPROVED','sms_queue','hod=admin; date=2026-08-19; count=1','2026-08-19 02:20:21'),(410,'system','SMS_SENT','student','24BT1A6733','2026-08-19 02:20:25'),(411,'Yashwanth Reddy','UPDATE','student','24BT1A6733 (self-edit)','2026-08-19 02:22:18'),(412,'admin','UPDATE','student','24BT1A6703','2026-08-19 02:25:09'),(413,'admin','LOGOUT','session','','2026-08-19 02:25:29'),(414,'Yashwanth Reddy','PHOTO','student','24BT1A6733 (self-upload)','2026-08-19 02:26:36'),(415,'Yashwanth Reddy','PHOTO_DELETE','student','24BT1A6733 (self-delete)','2026-08-19 02:26:42'),(416,'Yashwanth Reddy','PHOTO','student','24BT1A6733 (self-upload)','2026-08-19 02:27:49'),(417,'vcetcsdhod@gmail.com','REQUEST_OTP','register','vcetcsdhod@gmail.com','2026-08-19 02:28:09'),(418,'vcetcsdhod@gmail.com','VERIFY_OTP','register','vcetcsdhod@gmail.com','2026-08-19 02:28:36'),(419,'naveennani','SELF_REGISTER_NEW_STUDENT','student','25BT1A67000 (NaveenNani) — open registration, verified email','2026-08-19 02:28:37'),(420,'naveennani','SELF_REGISTER','student_login','25BT1A67000','2026-08-19 02:28:37'),(421,'naveennani','LOGIN','session','STUDENT','2026-08-19 02:28:55'),(422,'admin','CREATE','attendance_session','session=9; subject=13; type=CLASS; hours=1','2026-08-19 02:32:36'),(423,'admin','UPDATE','student','24BT1A6703','2026-08-19 02:33:54'),(424,'admin','LOGOUT','session','','2026-08-19 02:34:18'),(425,'facultytester','LOGIN','session','FACULTY','2026-08-19 02:34:25'),(426,'facultytester','SAVE','attendance_session','session=8; type=CLASS; hours=1; present=2; absent=6','2026-08-19 02:34:47'),(427,'facultytester','SMS_BLOCKED','sms_queue','roll=25BT1A67000; Parent phone number is missing for this student.','2026-08-19 02:34:47'),(428,'facultytester','SMS_QUEUED','attendance_session','session=8; queued=0; blocked=1; duplicate=5; no_phone=0; cap_blocked=0; repeat_mode=1; hod=admin','2026-08-19 02:34:47'),(429,'facultytester','LOGOUT','session','','2026-08-19 02:34:55'),(430,'admin','LOGIN','session','HOD','2026-08-19 02:34:59'),(431,'naveennani','LOGOUT','session','','2026-08-19 02:35:27'),(432,'admin','LOGIN','session','HOD','2026-08-19 02:35:33'),(433,'admin','UPDATE','student','25BT1A67000','2026-08-19 02:36:04'),(434,'admin','SMS_BATCH_APPROVED','sms_queue','hod=admin; date=2026-08-19; count=1','2026-08-19 02:36:11'),(435,'system','SMS_SENT','student','25BT1A67000','2026-08-19 02:36:17'),(436,'admin','UPDATE','student','25BT1A67000','2026-08-19 02:37:57'),(437,'facultytester','SAVE','attendance_session','session=8; type=CLASS; hours=1; present=2; absent=6','2026-08-19 02:38:03'),(438,'admin','UPDATE','student','24BT1A6703','2026-08-19 02:38:44'),(439,'facultytester','SAVE','attendance_session','session=8; type=CLASS; hours=1; present=1; absent=7','2026-08-19 02:38:58'),(440,'facultytester','SMS_QUEUED','attendance_session','session=8; queued=1; blocked=0; duplicate=6; no_phone=0; cap_blocked=0; repeat_mode=1; hod=admin','2026-08-19 02:38:58'),(441,'admin','SMS_BATCH_APPROVED','sms_queue','hod=admin; date=2026-08-19; count=1','2026-08-19 02:39:33'),(442,'system','SMS_SENT','student','24BT1A6703','2026-08-19 02:39:38'),(443,'admin','LOGOUT','session','','2026-08-19 02:42:37'),(444,'admin','LOGIN','session','HOD','2026-08-19 02:43:23'),(445,'admin','LOGOUT','session','','2026-08-19 02:53:19'),(446,'admin','LOGIN','session','HOD','2026-08-19 02:53:24'),(447,'Naveen','LOGIN','session','FACULTY','2026-08-19 02:53:38'),(448,'Naveen','LOGOUT','session','','2026-08-19 02:54:31'),(449,'admin','LOGIN','session','HOD','2026-08-19 02:54:40'),(450,'admin','UPDATE_USER_PERMISSIONS','user','faculty_csd','2026-08-19 02:55:01'),(451,'admin','UPDATE_USER_PERMISSIONS','user','faculty1','2026-08-19 02:55:13'),(452,'admin','UPDATE_USER_PERMISSIONS','user','faculty1','2026-08-19 02:56:00'),(453,'Naveen','LOGOUT','session','','2026-08-19 02:56:56'),(454,'facultytester','LOGIN','session','FACULTY','2026-08-19 02:57:10'),(455,'facultytester','CREATE','attendance_session','session=10; subject=154; type=CLASS; hours=1','2026-08-19 02:57:20'),(456,'facultytester','SAVE','attendance_session','session=10; type=CLASS; hours=1; present=7; absent=1','2026-08-19 02:58:39'),(457,'facultytester','LOGOUT','session','','2026-08-19 03:09:13'),(458,'admin','LOGIN','session','HOD','2026-08-19 03:09:41'),(459,'admin','LOGOUT','session','','2026-08-19 03:12:36'),(460,'admin','LOGOUT','session','','2026-08-19 03:12:39'),(461,'admin','LOGOUT','session','','2026-08-19 03:12:40'),(462,'admin','LOGOUT','session','','2026-08-19 03:12:41'),(463,'admin','LOGOUT','session','','2026-08-19 03:12:41'),(464,'admin','LOGIN','session','HOD','2026-08-19 23:10:28'),(465,'admin','LOGOUT','session','','2026-08-19 23:13:56'),(466,'Naveen','LOGIN','session','FACULTY','2026-08-19 23:14:09'),(467,'Naveen','LOGOUT','session','','2026-08-19 23:14:31'),(468,'facultytester','LOGIN','session','FACULTY','2026-08-19 23:14:36'),(469,'facultytester','CREATE','attendance_session','session=11; subject=11; type=CLASS; hours=1','2026-08-19 23:14:53'),(470,'facultytester','LOGOUT','session','','2026-08-19 23:17:05'),(471,'admin','LOGIN','session','HOD','2026-08-19 23:17:10'),(472,'admin','DELETE','student','25BT1A67000','2026-08-19 23:17:19'),(473,'facultytester','LOGIN','session','FACULTY','2026-08-19 23:17:51'),(474,'admin','LOGIN','session','HOD','2026-08-19 23:21:24'),(475,'admin','DELETE','student','24BT1A6722','2026-08-19 23:22:49'),(476,'admin','LOGOUT','session','','2026-08-19 23:22:54'),(477,'thirumala7240@gmail.com','REQUEST_OTP','register','thirumala7240@gmail.com','2026-08-19 23:24:35'),(478,'thirumala7240@gmail.com','VERIFY_OTP','register','thirumala7240@gmail.com','2026-08-19 23:25:03'),(479,'facultytester','LOGOUT','session','','2026-08-19 23:33:22'),(480,'admin','LOGIN','session','HOD','2026-08-19 23:33:42'),(481,'admin','DELETE','student','24BT1A6762','2026-08-19 23:33:50'),(482,'admin','DELETE','user','Naveen','2026-08-19 23:34:35'),(483,'admin','CREATE','user','Naveen (FACULTY)','2026-08-19 23:34:56'),(484,'admin','DELETE','user','faculty1','2026-08-19 23:35:08'),(485,'admin','DELETE','user','faculty_csd','2026-08-19 23:35:15'),(486,'admin','DELETE','user','faculty2','2026-08-19 23:35:20'),(487,'admin','LOGOUT','session','','2026-08-19 23:35:51'),(488,'Naveen','LOGIN','session','FACULTY','2026-08-19 23:35:55'),(489,'admin','UPDATE','subject_faculty','24CS503PC: faculty=[Naveen]','2026-08-19 23:36:23'),(490,'admin','DELETE','user','Divya','2026-08-19 23:36:49'),(491,'admin','CREATE','user','Divya (FACULTY)','2026-08-19 23:37:24'),(492,'admin','DELETE','user','faculty1','2026-08-19 23:41:38'),(493,'admin','DELETE','user','faculty2','2026-08-19 23:41:42'),(494,'admin','DELETE','user','faculty_csd','2026-08-19 23:41:46'),(495,'admin','CREATE','user','dummy (FACULTY)','2026-08-19 23:42:22'),(496,'admin','DELETE','user','dummy','2026-08-19 23:42:30'),(497,'Kishu__chowdhary','LOGIN','session','STUDENT','2026-08-19 23:44:13'),(498,'Kishu__chowdhary','LOGOUT','session','','2026-08-19 23:44:38'),(499,'Kishu__chowdhary','LOGIN','session','STUDENT','2026-08-19 23:44:48'),(500,'Akhil@123','LOGIN','session','STUDENT','2026-08-19 23:45:02'),(501,'Akhil@123','LOGIN','session','STUDENT','2026-08-19 23:45:49'),(502,'admin','DELETE','user','faculty1','2026-08-19 23:48:29'),(503,'admin','DELETE','user','faculty2','2026-08-19 23:48:33'),(504,'Kishu__chowdhary','LOGIN','session','STUDENT','2026-08-19 23:48:33'),(505,'admin','DELETE','user','faculty_csd','2026-08-19 23:48:36'),(506,'admin','CREATE','user','dummy (FACULTY)','2026-08-19 23:48:51'),(507,'admin','DELETE','user','dummy','2026-08-19 23:49:02'),(508,'Akhil@123','LOGIN','session','STUDENT','2026-08-19 23:49:12'),(509,'Naveen','LOGOUT','session','','2026-08-19 23:49:21'),(510,'shashankgoud356@gmail.com','REQUEST_OTP','register','shashankgoud356@gmail.com','2026-08-20 00:03:50'),(511,'shashankgoud356@gmail.com','VERIFY_OTP','register','shashankgoud356@gmail.com','2026-08-20 00:04:23'),(512,'Shashank','SELF_REGISTER_NEW_STUDENT','student','dwdwdqwd (Shashank) — open registration, verified email','2026-08-20 00:04:24'),(513,'Shashank','SELF_REGISTER','student_login','dwdwdqwd','2026-08-20 00:04:24'),(514,'Shashank','LOGIN','session','STUDENT','2026-08-20 00:04:32'),(515,'Naveen','LOGIN','session','FACULTY','2026-08-20 00:05:17'),(516,'student_1','LOGIN','session','STUDENT','2026-08-20 00:55:50'),(517,'admin','LOGIN','session','HOD','2026-08-20 00:55:50'),(518,'admin','CREATE','attendance_session','session=12; subject=154; type=LAB; hours=3','2026-08-20 00:55:50'),(519,'student_1','LOGIN','session','STUDENT','2026-08-20 00:57:48'),(520,'admin','LOGIN','session','HOD','2026-08-20 00:57:48'),(521,'student_1','LOGIN','session','STUDENT','2026-08-20 00:58:48'),(522,'admin','LOGIN','session','HOD','2026-08-20 00:58:48'),(523,'student_1','LOGIN','session','STUDENT','2026-08-20 01:00:48'),(524,'admin','LOGIN','session','HOD','2026-08-20 01:00:48'),(525,'student_1','LOGIN','session','STUDENT','2026-08-20 01:03:34'),(526,'admin','LOGIN','session','HOD','2026-08-20 01:03:35'),(527,'admin','CREATE','attendance_session','session=13; subject=154; type=CLASS; hours=1','2026-08-20 01:03:35'),(528,'admin','LOGIN','session','HOD','2026-08-20 01:07:06'),(529,'admin','DELETE','user','faculty2','2026-08-20 01:07:16'),(530,'Naveen','LOGIN','session','FACULTY','2026-08-20 01:07:27'),(531,'Naveen','CREATE','attendance_session','session=14; subject=9; type=CLASS; hours=1','2026-08-20 01:07:41'),(532,'Naveen','SAVE','attendance_session','session=14; type=CLASS; hours=1; present=5; absent=1','2026-08-20 01:08:22'),(533,'Naveen','SMS_QUEUED','attendance_session','session=14; queued=1; blocked=0; duplicate=0; no_phone=0; cap_blocked=0; repeat_mode=1; hod=admin','2026-08-20 01:08:22'),(534,'admin','LOGIN','session','HOD','2026-08-20 01:08:29'),(535,'admin','SMS_BATCH_APPROVED','sms_queue','hod=admin; date=2026-08-20; count=1','2026-08-20 01:08:32'),(536,'system','SMS_FAILED','student','24BT1A6703: SMSGate Cloud HTTP 401: {\'message\': \'Unauthorized\'}','2026-08-20 01:08:36'),(537,'admin','PHOTO_DELETE','user','admin (photo removed)','2026-08-20 01:08:41'),(538,'admin','UPDATE','sms_gateway','gateway=1; hod=admin','2026-08-20 01:10:02'),(539,'admin','UPDATE','sms_gateway','gateway=1; hod=admin','2026-08-20 01:10:38'),(540,'Naveen','SAVE','attendance_session','session=14; type=CLASS; hours=1; present=5; absent=1','2026-08-20 01:12:14'),(541,'Naveen','SMS_QUEUED','attendance_session','session=14; queued=1; blocked=0; duplicate=0; no_phone=0; cap_blocked=0; repeat_mode=1; hod=admin','2026-08-20 01:12:14'),(542,'admin','SMS_BATCH_APPROVED','sms_queue','hod=admin; date=2026-08-20; count=1','2026-08-20 01:12:25'),(543,'system','SMS_SENT','student','24BT1A6712','2026-08-20 01:12:26'),(544,'admin','LOGOUT','session','','2026-08-20 01:13:19'),(545,'admin','DELETE','student','dwdwdqwd','2026-08-20 01:14:16'),(546,'Naveen','LOGOUT','session','','2026-08-20 01:14:29'),(547,'thirumala7240@gmail.com','REQUEST_OTP','register','thirumala7240@gmail.com','2026-08-20 01:14:34'),(548,'thirumala7240@gmail.com','VERIFY_OTP','register','thirumala7240@gmail.com','2026-08-20 01:15:30'),(549,'Thirumala','SELF_REGISTER_NEW_STUDENT','student','23BT1A6722 (G Thirumala) — open registration, verified email','2026-08-20 01:15:32'),(550,'Thirumala','SELF_REGISTER','student_login','23BT1A6722','2026-08-20 01:15:32'),(551,'Thirumala','LOGIN','session','STUDENT','2026-08-20 01:15:41'),(552,'Thirumala','PHOTO','student','23BT1A6722 (self-upload)','2026-08-20 01:16:08'),(553,'Thirumala','UPDATE','student','23BT1A6722 (self-edit)','2026-08-20 01:18:06'),(554,'Thirumala','LOGOUT','session','','2026-08-20 01:18:11'),(555,'admin','LOGIN','session','HOD','2026-08-20 01:18:25'),(556,'shashankgoud356@gmail.com','REQUEST_OTP','register','shashankgoud356@gmail.com','2026-08-20 01:18:40'),(557,'shashankgoud356@gmail.com','VERIFY_OTP','register','shashankgoud356@gmail.com','2026-08-20 01:19:21'),(558,'Shashank1244','SELF_REGISTER_NEW_STUDENT','student','25BT1A6762 (Shashank) — open registration, verified email','2026-08-20 01:19:21'),(559,'Shashank1244','SELF_REGISTER','student_login','25BT1A6762','2026-08-20 01:19:21'),(560,'admin','UPDATE_USER_PERMISSIONS','user','Naveen','2026-08-20 01:19:26'),(561,'Shashank1244','LOGIN','session','STUDENT','2026-08-20 01:19:34'),(562,'admin','UPDATE_USER_PERMISSIONS','user','Srikanth','2026-08-20 01:19:42'),(563,'admin','DELETE','user','Srikanth','2026-08-20 01:19:49'),(564,'admin','CREATE','subject','00001 - MAJOR PRO (semester=7)','2026-08-20 01:21:59'),(565,'admin','CREATE','subject','00002 - THE END (semester=8)','2026-08-20 01:22:19'),(566,'admin','CREATE','attendance_session','session=15; subject=662; type=CLASS; hours=1','2026-08-20 01:22:49'),(567,'admin','LOGOUT','session','','2026-08-20 01:24:24'),(568,'Naveen','LOGIN','session','FACULTY','2026-08-20 01:24:51'),(569,'admin','UPDATE','subject_faculty','00001: faculty=[Naveen]','2026-08-20 01:25:34'),(570,'Naveen','CREATE','attendance_session','session=16; subject=662; type=CLASS; hours=1','2026-08-20 01:26:07'),(571,'Naveen','SAVE','attendance_session','session=16; type=CLASS; hours=1; present=1; absent=0','2026-08-20 01:26:24'),(572,'admin','DELETE','student','25BT1A6762','2026-08-20 01:27:16'),(573,'Shashank1244','LOGOUT','session','','2026-08-20 01:27:21'),(574,'shashankgoud356@gmail.com','REQUEST_OTP','register','shashankgoud356@gmail.com','2026-08-20 01:28:05'),(575,'shashankgoud356@gmail.com','VERIFY_OTP','register','shashankgoud356@gmail.com','2026-08-20 01:28:26'),(576,'Shashank1244','SELF_REGISTER_NEW_STUDENT','student','25BT1A6762 (Shashank) — open registration, verified email','2026-08-20 01:28:30'),(577,'Shashank1244','SELF_REGISTER','student_login','25BT1A6762','2026-08-20 01:28:30'),(578,'admin','LOGIN','session','HOD','2026-08-20 02:19:24'),(579,'admin','LOGOUT','session','','2026-08-20 02:43:21'),(580,'Naveen','LOGIN','session','FACULTY','2026-08-20 02:43:25'),(581,'admin','LOGIN','session','HOD','2026-08-20 02:48:31'),(582,'admin','LOGOUT','session','','2026-08-20 02:48:39'),(583,'student_1','LOGIN','session','STUDENT','2026-08-20 02:48:45'),(584,'Kishu__chowdhary','LOGIN','session','STUDENT','2026-08-20 02:55:10'),(585,'student_1','LOGIN','session','STUDENT','2026-08-20 03:04:09'),(586,'admin','LOGIN','session','HOD','2026-08-20 03:04:10'),(587,'student_1','LOGIN','session','STUDENT','2026-08-20 03:07:49'),(588,'admin','LOGIN','session','HOD','2026-08-20 03:07:50'),(589,'admin','LOGIN','session','HOD','2026-08-20 03:10:53'),(590,'admin','LOGIN','session','HOD','2026-08-20 03:10:53'),(591,'admin','LOGIN','session','HOD','2026-08-20 03:10:53'),(592,'admin','CREATE','student','zzqaa24ca6ad_R001','2026-08-20 03:10:54'),(593,'admin','CREATE','student_login','zzqaa24ca6ad_R001','2026-08-20 03:10:55'),(594,'admin','UPDATE','student','zzqaa24ca6ad_R001','2026-08-20 03:10:55'),(595,'admin','STATUS','student','zzqaa24ca6ad_R001 -> 0','2026-08-20 03:10:55'),(596,'admin','DELETE','student','zzqaa24ca6ad_R001','2026-08-20 03:10:55'),(597,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 03:10:56'),(598,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 03:10:56'),(599,'admin','CREATE','subject','ZZQAA24CA6ADDUP - ZZQA Duplicate Probe (semester=1)','2026-08-20 03:10:57'),(600,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 03:10:58'),(601,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 03:10:58'),(602,'student_1','LOGIN','session','STUDENT','2026-08-20 03:11:08'),(603,'admin','LOGIN','session','HOD','2026-08-20 03:11:08'),(604,'student_1','LOGIN','session','STUDENT','2026-08-20 03:11:30'),(605,'admin','LOGIN','session','HOD','2026-08-20 03:11:30'),(606,'student_1','LOGIN','session','STUDENT','2026-08-20 03:11:51'),(607,'admin','LOGIN','session','HOD','2026-08-20 03:11:52'),(608,'student_1','LOGIN','session','STUDENT','2026-08-20 03:12:21'),(609,'admin','LOGIN','session','HOD','2026-08-20 03:12:21'),(610,'student_1','LOGIN','session','STUDENT','2026-08-20 03:12:37'),(611,'admin','LOGIN','session','HOD','2026-08-20 03:12:38'),(612,'Naveen','LOGOUT','session','','2026-08-20 03:16:30'),(613,'Naveen','LOGIN','session','FACULTY','2026-08-20 03:16:34'),(614,'student_1','LOGIN','session','STUDENT','2026-08-20 03:20:46'),(615,'admin','LOGIN','session','HOD','2026-08-20 03:20:47'),(616,'student_1','LOGIN','session','STUDENT','2026-08-20 03:23:06'),(617,'admin','LOGIN','session','HOD','2026-08-20 03:23:06'),(618,'Naveen','LOGOUT','session','','2026-08-20 03:23:39'),(619,'admin','LOGIN','session','HOD','2026-08-20 03:23:48'),(620,'admin','CREATE','subject','2CSERA - OLAP (semester=7)','2026-08-20 03:25:49'),(621,'admin','UPDATE','subject_faculty','2CSERA: faculty=[Srikanth]','2026-08-20 03:26:03'),(622,'admin','STATUS','subject','24CS512PE -> inactive','2026-08-20 03:26:43'),(623,'admin','STATUS','subject','24CS512PE -> active','2026-08-20 03:26:43'),(624,'admin','STATUS','subject','24CS512PE -> inactive','2026-08-20 03:26:51'),(625,'admin','STATUS','subject','24CS512PE -> active','2026-08-20 03:26:55'),(626,'admin','LOGIN','session','HOD','2026-08-20 03:31:57'),(627,'admin','LOGIN','session','HOD','2026-08-20 03:31:57'),(628,'admin','LOGIN','session','HOD','2026-08-20 03:31:57'),(629,'admin','CREATE','student','zzqa1cc225b5_R001','2026-08-20 03:31:58'),(630,'admin','CREATE','student_login','zzqa1cc225b5_R001','2026-08-20 03:31:58'),(631,'admin','UPDATE','student','zzqa1cc225b5_R001','2026-08-20 03:31:58'),(632,'admin','STATUS','student','zzqa1cc225b5_R001 -> 0','2026-08-20 03:31:58'),(633,'admin','DELETE','student','zzqa1cc225b5_R001','2026-08-20 03:31:58'),(634,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 03:31:59'),(635,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 03:32:00'),(636,'admin','CREATE','subject','ZZQA1CC225B5DUP - ZZQA Duplicate Probe (semester=1)','2026-08-20 03:32:00'),(637,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 03:32:01'),(638,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 03:32:01'),(639,'admin','LOGIN','session','HOD','2026-08-20 03:34:52'),(640,'admin','LOGIN','session','HOD','2026-08-20 03:34:53'),(641,'admin','LOGIN','session','HOD','2026-08-20 03:34:53'),(642,'admin','CREATE','student','zzqa01d2cbda_R001','2026-08-20 03:34:53'),(643,'admin','CREATE','student_login','zzqa01d2cbda_R001','2026-08-20 03:34:54'),(644,'admin','UPDATE','student','zzqa01d2cbda_R001','2026-08-20 03:34:54'),(645,'admin','STATUS','student','zzqa01d2cbda_R001 -> 0','2026-08-20 03:34:54'),(646,'admin','DELETE','student','zzqa01d2cbda_R001','2026-08-20 03:34:54'),(647,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 03:34:55'),(648,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 03:34:55'),(649,'admin','CREATE','subject','ZZQA01D2CBDADUP - ZZQA Duplicate Probe (semester=1)','2026-08-20 03:34:55'),(650,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 03:34:56'),(651,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 03:34:56'),(652,'admin','LOGIN','session','HOD','2026-08-20 03:36:09'),(653,'admin','LOGIN','session','HOD','2026-08-20 03:36:10'),(654,'admin','LOGIN','session','HOD','2026-08-20 03:36:10'),(655,'admin','LOGIN','session','HOD','2026-08-20 03:38:08'),(656,'admin','LOGIN','session','HOD','2026-08-20 03:38:08'),(657,'admin','LOGIN','session','HOD','2026-08-20 03:38:09'),(658,'admin','LOGIN','session','HOD','2026-08-20 03:38:28'),(659,'admin','LOGIN','session','HOD','2026-08-20 03:39:03'),(660,'admin','LOGOUT','session','','2026-08-20 03:39:03'),(661,'admin','LOGIN','session','HOD','2026-08-20 03:39:09'),(662,'admin','LOGIN','session','HOD','2026-08-20 03:39:10'),(663,'admin','LOGIN','session','HOD','2026-08-20 03:39:10'),(664,'admin','LOGIN','session','HOD','2026-08-20 03:39:24'),(665,'admin','LOGIN','session','HOD','2026-08-20 03:39:24'),(666,'admin','LOGIN','session','HOD','2026-08-20 03:39:24'),(667,'admin','LOGIN','session','HOD','2026-08-20 03:39:42'),(668,'admin','LOGIN','session','HOD','2026-08-20 03:39:42'),(669,'admin','LOGIN','session','HOD','2026-08-20 03:39:42'),(670,'admin','LOGIN','session','HOD','2026-08-20 03:40:03'),(671,'admin','LOGIN','session','HOD','2026-08-20 03:40:03'),(672,'admin','LOGIN','session','HOD','2026-08-20 03:40:03'),(673,'admin','LOGIN','session','HOD','2026-08-20 03:40:04'),(674,'admin','LOGOUT','session','','2026-08-20 03:40:04'),(675,'admin','LOGIN','session','HOD','2026-08-20 03:40:50'),(676,'admin','LOGIN','session','HOD','2026-08-20 03:40:50'),(677,'admin','LOGIN','session','HOD','2026-08-20 03:40:50'),(678,'admin','LOGIN','session','HOD','2026-08-20 03:40:51'),(679,'admin','LOGOUT','session','','2026-08-20 03:40:51'),(680,'student_1','LOGIN','session','STUDENT','2026-08-20 03:40:54'),(681,'admin','LOGIN','session','HOD','2026-08-20 03:40:55'),(682,'admin','CREATE','student','zzqaf3fe690d_R001','2026-08-20 03:40:55'),(683,'admin','CREATE','student_login','zzqaf3fe690d_R001','2026-08-20 03:40:55'),(684,'admin','UPDATE','student','zzqaf3fe690d_R001','2026-08-20 03:40:55'),(685,'admin','STATUS','student','zzqaf3fe690d_R001 -> 0','2026-08-20 03:40:55'),(686,'admin','DELETE','student','zzqaf3fe690d_R001','2026-08-20 03:40:56'),(687,'student_1','LOGIN','session','STUDENT','2026-08-20 03:41:00'),(688,'admin','LOGIN','session','HOD','2026-08-20 03:41:00'),(689,'admin','CREATE','attendance_session','session=17; subject=890; type=CLASS; hours=1','2026-08-20 03:41:00'),(690,'admin','CREATE','attendance_session','session=18; subject=890; type=LAB; hours=3','2026-08-20 03:41:00'),(691,'student_1','LOGIN','session','STUDENT','2026-08-20 03:41:05'),(692,'admin','LOGIN','session','HOD','2026-08-20 03:41:05'),(693,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 03:41:05'),(694,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 03:41:05'),(695,'student_1','LOGIN','session','STUDENT','2026-08-20 03:41:10'),(696,'admin','LOGIN','session','HOD','2026-08-20 03:41:10'),(697,'admin','LOGIN','session','HOD','2026-08-20 03:41:10'),(698,'admin','CREATE','subject','ZZQAB8F0A71DDUP - ZZQA Duplicate Probe (semester=1)','2026-08-20 03:41:10'),(699,'admin','LOGIN','session','HOD','2026-08-20 03:41:14'),(700,'student_1','LOGIN','session','STUDENT','2026-08-20 03:41:15'),(701,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA automated test report zzqa066f2e68','2026-08-20 03:41:15'),(702,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA lifecycle probe zzqa066f2e68','2026-08-20 03:41:15'),(703,'admin','UPDATE_PROBLEM_REPORT','report','ID 16 -> RESOLVED','2026-08-20 03:41:15'),(704,'admin','LOGIN','session','HOD','2026-08-20 03:41:20'),(705,'student_1','LOGIN','session','STUDENT','2026-08-20 03:41:20'),(706,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 03:41:20'),(707,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 03:41:20'),(708,'student_1','UPDATE','student','24BT!A6766 (self-edit)','2026-08-20 03:41:20'),(709,'admin','LOGIN','session','HOD','2026-08-20 03:42:20'),(710,'admin','LOGIN','session','HOD','2026-08-20 03:42:20'),(711,'admin','LOGIN','session','HOD','2026-08-20 03:42:20'),(712,'admin','LOGIN','session','HOD','2026-08-20 03:42:20'),(713,'admin','LOGOUT','session','','2026-08-20 03:42:21'),(714,'student_1','LOGIN','session','STUDENT','2026-08-20 03:42:24'),(715,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 03:42:24'),(716,'admin','LOGIN','session','HOD','2026-08-20 03:42:25'),(717,'admin','CREATE','student','zzqa8411803a_R001','2026-08-20 03:42:25'),(718,'admin','CREATE','student_login','zzqa8411803a_R001','2026-08-20 03:42:25'),(719,'admin','UPDATE','student','zzqa8411803a_R001','2026-08-20 03:42:25'),(720,'admin','STATUS','student','zzqa8411803a_R001 -> 0','2026-08-20 03:42:25'),(721,'admin','DELETE','student','zzqa8411803a_R001','2026-08-20 03:42:25'),(722,'student_1','LOGIN','session','STUDENT','2026-08-20 03:42:29'),(723,'admin','LOGIN','session','HOD','2026-08-20 03:42:30'),(724,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 03:42:34'),(725,'student_1','LOGIN','session','STUDENT','2026-08-20 03:42:34'),(726,'admin','LOGIN','session','HOD','2026-08-20 03:42:35'),(727,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 03:42:35'),(728,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 03:42:35'),(729,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 03:42:39'),(730,'student_1','LOGIN','session','STUDENT','2026-08-20 03:42:39'),(731,'admin','LOGIN','session','HOD','2026-08-20 03:42:39'),(732,'admin','LOGIN','session','HOD','2026-08-20 03:42:40'),(733,'admin','CREATE','subject','ZZQA0E018655DUP - ZZQA Duplicate Probe (semester=1)','2026-08-20 03:42:40'),(734,'admin','LOGIN','session','HOD','2026-08-20 03:42:44'),(735,'student_1','LOGIN','session','STUDENT','2026-08-20 03:42:44'),(736,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 03:42:45'),(737,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA automated test report zzqaf4db5a3e','2026-08-20 03:42:45'),(738,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA lifecycle probe zzqaf4db5a3e','2026-08-20 03:42:45'),(739,'admin','UPDATE_PROBLEM_REPORT','report','ID 18 -> RESOLVED','2026-08-20 03:42:45'),(740,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 03:42:49'),(741,'admin','LOGIN','session','HOD','2026-08-20 03:42:49'),(742,'student_1','LOGIN','session','STUDENT','2026-08-20 03:42:49'),(743,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 03:42:49'),(744,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 03:42:50'),(745,'student_1','UPDATE','student','24BT!A6766 (self-edit)','2026-08-20 03:42:50'),(746,'admin','LOGIN','session','HOD','2026-08-20 03:43:17'),(747,'admin','LOGIN','session','HOD','2026-08-20 03:43:17'),(748,'admin','LOGIN','session','HOD','2026-08-20 03:43:17'),(749,'admin','LOGIN','session','HOD','2026-08-20 03:43:18'),(750,'admin','LOGOUT','session','','2026-08-20 03:43:18'),(751,'student_1','LOGIN','session','STUDENT','2026-08-20 03:43:22'),(752,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 03:43:22'),(753,'admin','LOGIN','session','HOD','2026-08-20 03:43:22'),(754,'admin','CREATE','student','zzqae80b561d_R001','2026-08-20 03:43:22'),(755,'admin','CREATE','student_login','zzqae80b561d_R001','2026-08-20 03:43:22'),(756,'admin','UPDATE','student','zzqae80b561d_R001','2026-08-20 03:43:23'),(757,'admin','STATUS','student','zzqae80b561d_R001 -> 0','2026-08-20 03:43:23'),(758,'admin','DELETE','student','zzqae80b561d_R001','2026-08-20 03:43:23'),(759,'student_1','LOGIN','session','STUDENT','2026-08-20 03:43:26'),(760,'admin','LOGIN','session','HOD','2026-08-20 03:43:27'),(761,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 03:43:31'),(762,'student_1','LOGIN','session','STUDENT','2026-08-20 03:43:31'),(763,'admin','LOGIN','session','HOD','2026-08-20 03:43:31'),(764,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 03:43:31'),(765,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 03:43:31'),(766,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 03:43:35'),(767,'student_1','LOGIN','session','STUDENT','2026-08-20 03:43:36'),(768,'admin','LOGIN','session','HOD','2026-08-20 03:43:36'),(769,'admin','CREATE','subject','ZZQA1F33B928DUP - ZZQA Duplicate Probe (semester=1)','2026-08-20 03:43:36'),(770,'admin','LOGIN','session','HOD','2026-08-20 03:43:41'),(771,'student_1','LOGIN','session','STUDENT','2026-08-20 03:43:41'),(772,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 03:43:41'),(773,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA automated test report zzqab174f87f','2026-08-20 03:43:41'),(774,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA lifecycle probe zzqab174f87f','2026-08-20 03:43:41'),(775,'admin','UPDATE_PROBLEM_REPORT','report','ID 20 -> RESOLVED','2026-08-20 03:43:41'),(776,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 03:43:45'),(777,'admin','LOGIN','session','HOD','2026-08-20 03:43:45'),(778,'student_1','LOGIN','session','STUDENT','2026-08-20 03:43:45'),(779,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 03:43:46'),(780,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 03:43:46'),(781,'student_1','UPDATE','student','24BT!A6766 (self-edit)','2026-08-20 03:43:46'),(782,'admin','LOGIN','session','HOD','2026-08-20 03:44:20'),(783,'admin','LOGIN','session','HOD','2026-08-20 03:44:20'),(784,'admin','LOGIN','session','HOD','2026-08-20 03:44:20'),(785,'admin','LOGIN','session','HOD','2026-08-20 03:44:21'),(786,'admin','LOGOUT','session','','2026-08-20 03:44:21'),(787,'student_1','LOGIN','session','STUDENT','2026-08-20 03:44:25'),(788,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 03:44:25'),(789,'admin','LOGIN','session','HOD','2026-08-20 03:44:25'),(790,'admin','CREATE','student','zzqa4fae52f1_R001','2026-08-20 03:44:25'),(791,'admin','CREATE','student_login','zzqa4fae52f1_R001','2026-08-20 03:44:25'),(792,'admin','UPDATE','student','zzqa4fae52f1_R001','2026-08-20 03:44:26'),(793,'admin','STATUS','student','zzqa4fae52f1_R001 -> 0','2026-08-20 03:44:26'),(794,'admin','DELETE','student','zzqa4fae52f1_R001','2026-08-20 03:44:26'),(795,'student_1','LOGIN','session','STUDENT','2026-08-20 03:44:29'),(796,'admin','LOGIN','session','HOD','2026-08-20 03:44:30'),(797,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 03:44:34'),(798,'student_1','LOGIN','session','STUDENT','2026-08-20 03:44:34'),(799,'admin','LOGIN','session','HOD','2026-08-20 03:44:34'),(800,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 03:44:35'),(801,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 03:44:35'),(802,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 03:44:38'),(803,'student_1','LOGIN','session','STUDENT','2026-08-20 03:44:39'),(804,'admin','LOGIN','session','HOD','2026-08-20 03:44:39'),(805,'admin','CREATE','subject','ZZQAD5481977DUP - ZZQA Duplicate Probe (semester=1)','2026-08-20 03:44:39'),(806,'admin','LOGIN','session','HOD','2026-08-20 03:44:43'),(807,'student_1','LOGIN','session','STUDENT','2026-08-20 03:44:44'),(808,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 03:44:44'),(809,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA automated test report zzqaee0fbf4f','2026-08-20 03:44:44'),(810,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA lifecycle probe zzqaee0fbf4f','2026-08-20 03:44:44'),(811,'admin','UPDATE_PROBLEM_REPORT','report','ID 22 -> RESOLVED','2026-08-20 03:44:44'),(812,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 03:44:48'),(813,'admin','LOGIN','session','HOD','2026-08-20 03:44:48'),(814,'student_1','LOGIN','session','STUDENT','2026-08-20 03:44:48'),(815,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 03:44:49'),(816,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 03:44:49'),(817,'student_1','UPDATE','student','24BT!A6766 (self-edit)','2026-08-20 03:44:49'),(818,'admin','LOGOUT','session','','2026-08-20 03:50:11'),(819,'Thirumala','LOGIN','session','STUDENT','2026-08-20 03:50:16'),(820,'Thirumala','LOGOUT','session','','2026-08-20 03:50:29'),(821,'admin','LOGIN','session','HOD','2026-08-20 21:35:53'),(822,'admin','UPDATE_PROBLEM_REPORT','report','ID 21 -> CLOSED','2026-08-20 21:41:48'),(823,'admin','ATTENDANCE_DELETE_ALL','attendance','Deleted all old attendance sessions and records','2026-08-20 21:42:18'),(824,'student_1','LOGIN','session','STUDENT','2026-08-20 21:42:45'),(825,'admin','LOGIN','session','HOD','2026-08-20 21:42:45'),(826,'admin','CREATE','attendance_session','session=1; subject=890; type=CLASS; hours=1','2026-08-20 21:42:45'),(827,'admin','CREATE','attendance_session','session=2; subject=890; type=LAB; hours=3','2026-08-20 21:42:45'),(828,'admin','DELETE','user','dummy','2026-08-20 21:44:29'),(829,'admin','DELETE','user','faculty_csd','2026-08-20 21:49:22'),(830,'admin','DELETE','user','faculty2','2026-08-20 21:50:12'),(831,'admin','DELETE','user','facultytester','2026-08-20 21:51:09'),(832,'admin','DELETE','user','Newfaculty','2026-08-20 21:51:13'),(833,'admin','DELETE','user','Srikanth','2026-08-20 21:51:41'),(834,'admin','DELETE','user','faculty1','2026-08-20 21:51:45'),(835,'admin','LOGIN','session','HOD','2026-08-20 21:52:14'),(836,'admin','LOGIN','session','HOD','2026-08-20 21:52:14'),(837,'admin','LOGIN','session','HOD','2026-08-20 21:52:14'),(838,'admin','LOGIN','session','HOD','2026-08-20 21:52:15'),(839,'admin','LOGOUT','session','','2026-08-20 21:52:15'),(840,'student_1','LOGIN','session','STUDENT','2026-08-20 21:52:15'),(841,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 21:52:15'),(842,'admin','CREATE','student','zzqa7267b0fc_R001','2026-08-20 21:52:15'),(843,'admin','CREATE','student_login','zzqa7267b0fc_R001','2026-08-20 21:52:15'),(844,'admin','UPDATE','student','zzqa7267b0fc_R001','2026-08-20 21:52:16'),(845,'admin','STATUS','student','zzqa7267b0fc_R001 -> 0','2026-08-20 21:52:16'),(846,'admin','DELETE','student','zzqa7267b0fc_R001','2026-08-20 21:52:16'),(847,'admin','CREATE','attendance_session','session=1; subject=890; type=CLASS; hours=1','2026-08-20 21:52:16'),(848,'admin','CREATE','attendance_session','session=2; subject=890; type=LAB; hours=3','2026-08-20 21:52:16'),(849,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 21:52:16'),(850,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 21:52:17'),(851,'admin','CREATE','subject','ZZQA7267B0FCDUP - ZZQA Duplicate Probe (semester=1)','2026-08-20 21:52:17'),(852,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA automated test report zzqa7267b0fc','2026-08-20 21:52:17'),(853,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA lifecycle probe zzqa7267b0fc','2026-08-20 21:52:17'),(854,'admin','UPDATE_PROBLEM_REPORT','report','ID 24 -> RESOLVED','2026-08-20 21:52:17'),(855,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 21:52:18'),(856,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 21:52:18'),(857,'student_1','UPDATE','student','24BT!A6766 (self-edit)','2026-08-20 21:52:18'),(858,'admin','DELETE','user','Divya','2026-08-20 21:54:00'),(859,'admin','DELETE','user','dummy','2026-08-20 21:54:11'),(860,'admin','DELETE','user','faculty_csd','2026-08-20 21:54:14'),(861,'admin','DELETE','user','faculty2','2026-08-20 21:54:19'),(862,'admin','DELETE','user','faculty1','2026-08-20 21:54:22'),(863,'admin','DELETE','user','Naveen','2026-08-20 21:54:26'),(864,'admin','DELETE','user','Srikanth','2026-08-20 21:54:29'),(865,'admin','LOGIN','session','HOD','2026-08-20 21:58:39'),(866,'admin','LOGIN','session','HOD','2026-08-20 21:58:39'),(867,'admin','LOGIN','session','HOD','2026-08-20 21:58:39'),(868,'admin','LOGIN','session','HOD','2026-08-20 21:58:39'),(869,'admin','LOGOUT','session','','2026-08-20 21:58:39'),(870,'student_1','LOGIN','session','STUDENT','2026-08-20 21:58:40'),(871,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 21:58:40'),(872,'admin','CREATE','student','zzqa531320e6_R001','2026-08-20 21:58:40'),(873,'admin','CREATE','student_login','zzqa531320e6_R001','2026-08-20 21:58:40'),(874,'admin','UPDATE','student','zzqa531320e6_R001','2026-08-20 21:58:40'),(875,'admin','STATUS','student','zzqa531320e6_R001 -> 0','2026-08-20 21:58:40'),(876,'admin','DELETE','student','zzqa531320e6_R001','2026-08-20 21:58:40'),(877,'admin','CREATE','attendance_session','session=3; subject=890; type=CLASS; hours=1','2026-08-20 21:58:40'),(878,'admin','CREATE','attendance_session','session=4; subject=890; type=LAB; hours=3','2026-08-20 21:58:41'),(879,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 21:58:41'),(880,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 21:58:41'),(881,'admin','CREATE','subject','ZZQA531320E6DUP - ZZQA Duplicate Probe (semester=1)','2026-08-20 21:58:42'),(882,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA automated test report zzqa531320e6','2026-08-20 21:58:42'),(883,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA lifecycle probe zzqa531320e6','2026-08-20 21:58:42'),(884,'admin','UPDATE_PROBLEM_REPORT','report','ID 26 -> RESOLVED','2026-08-20 21:58:42'),(885,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 21:58:42'),(886,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 21:58:42'),(887,'student_1','UPDATE','student','24BT!A6766 (self-edit)','2026-08-20 21:58:43'),(888,'admin','DELETE','user','Divya','2026-08-20 22:04:07'),(889,'admin','DELETE','user','Srikanth','2026-08-20 22:04:30'),(890,'admin','CREATE','user','test_faculty_del (FACULTY)','2026-08-20 22:07:25'),(891,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 22:09:12'),(892,'student_1','LOGIN','session','STUDENT','2026-08-20 22:09:12'),(893,'admin','LOGIN','session','HOD','2026-08-20 22:09:12'),(894,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 22:09:12'),(895,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 22:09:12'),(896,'admin','LOGIN','session','HOD','2026-08-20 22:09:23'),(897,'admin','LOGIN','session','HOD','2026-08-20 22:09:23'),(898,'admin','LOGIN','session','HOD','2026-08-20 22:09:23'),(899,'admin','LOGIN','session','HOD','2026-08-20 22:09:24'),(900,'admin','LOGOUT','session','','2026-08-20 22:09:24'),(901,'student_1','LOGIN','session','STUDENT','2026-08-20 22:09:24'),(902,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 22:09:24'),(903,'admin','CREATE','student','zzqa3194e995_R001','2026-08-20 22:09:24'),(904,'admin','CREATE','student_login','zzqa3194e995_R001','2026-08-20 22:09:25'),(905,'admin','UPDATE','student','zzqa3194e995_R001','2026-08-20 22:09:25'),(906,'admin','STATUS','student','zzqa3194e995_R001 -> 0','2026-08-20 22:09:25'),(907,'admin','DELETE','student','zzqa3194e995_R001','2026-08-20 22:09:25'),(908,'admin','CREATE','attendance_session','session=5; subject=890; type=CLASS; hours=1','2026-08-20 22:09:25'),(909,'admin','CREATE','attendance_session','session=6; subject=890; type=LAB; hours=3','2026-08-20 22:09:25'),(910,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 22:09:26'),(911,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 22:09:26'),(912,'admin','CREATE','subject','ZZQA3194E995DUP - ZZQA Duplicate Probe (semester=1)','2026-08-20 22:09:26'),(913,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA automated test report zzqa3194e995','2026-08-20 22:09:26'),(914,'student_1','SUBMIT_PROBLEM_REPORT','report','ZZQA lifecycle probe zzqa3194e995','2026-08-20 22:09:26'),(915,'admin','UPDATE_PROBLEM_REPORT','report','ID 28 -> RESOLVED','2026-08-20 22:09:26'),(916,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 22:09:27'),(917,'admin','UPDATE','user','admin (self-edit profile)','2026-08-20 22:09:27'),(918,'student_1','UPDATE','student','24BT!A6766 (self-edit)','2026-08-20 22:09:27'),(919,'admin','PERMANENT_CLEANUP','all_profiles','Purged all faculty and student profiles','2026-08-20 22:12:34'),(920,'admin','LOGIN','session','HOD','2026-08-20 22:12:59'),(921,'admin','LOGIN','session','HOD','2026-08-20 22:12:59'),(922,'admin','LOGIN','session','HOD','2026-08-20 22:12:59'),(923,'admin','LOGIN','session','HOD','2026-08-20 22:13:00'),(924,'admin','LOGOUT','session','','2026-08-20 22:13:00'),(925,'faculty_csd','LOGIN','session','FACULTY','2026-08-20 22:13:00'),(926,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 22:13:00'),(927,'admin','UPDATE_PERMISSIONS','role','FACULTY','2026-08-20 22:13:01'),(928,'admin','PERMANENT_PURGE','all_profiles','Purged all non-admin profiles permanently','2026-08-20 22:13:54'),(929,'admin','CREATE','user','Srikanth (HOD)','2026-08-20 22:26:25');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bonafide_issues`
--

DROP TABLE IF EXISTS `bonafide_issues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bonafide_issues` (
  `id` int NOT NULL AUTO_INCREMENT,
  `roll_no` varchar(64) NOT NULL,
  `academic_year` varchar(32) NOT NULL,
  `purpose` varchar(255) NOT NULL,
  `generated_by` varchar(64) NOT NULL,
  `generated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `generated_by` (`generated_by`),
  KEY `idx_bonafide_issues_roll` (`roll_no`,`generated_at`),
  CONSTRAINT `bonafide_issues_ibfk_1` FOREIGN KEY (`roll_no`) REFERENCES `students` (`roll_no`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `bonafide_issues_ibfk_2` FOREIGN KEY (`generated_by`) REFERENCES `users` (`username`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bonafide_issues`
--

LOCK TABLES `bonafide_issues` WRITE;
/*!40000 ALTER TABLE `bonafide_issues` DISABLE KEYS */;
/*!40000 ALTER TABLE `bonafide_issues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `checklist`
--

DROP TABLE IF EXISTS `checklist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `checklist` (
  `id` int NOT NULL AUTO_INCREMENT,
  `roll_no` varchar(64) NOT NULL,
  `item` varchar(255) NOT NULL,
  `status` varchar(64) NOT NULL DEFAULT 'Pending',
  PRIMARY KEY (`id`),
  UNIQUE KEY `roll_no` (`roll_no`,`item`),
  CONSTRAINT `checklist_ibfk_1` FOREIGN KEY (`roll_no`) REFERENCES `students` (`roll_no`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `checklist_chk_1` CHECK ((`status` in (_utf8mb4'Pending',_utf8mb4'Complete',_utf8mb4'Available',_utf8mb4'Not Applicable')))
) ENGINE=InnoDB AUTO_INCREMENT=139 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `checklist`
--

LOCK TABLES `checklist` WRITE;
/*!40000 ALTER TABLE `checklist` DISABLE KEYS */;
/*!40000 ALTER TABLE `checklist` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_otps`
--

DROP TABLE IF EXISTS `email_otps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_otps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `purpose` varchar(32) NOT NULL,
  `code_hash` varchar(255) NOT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) NOT NULL DEFAULT '0',
  `verified_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_email_otps_email_purpose` (`email`,`purpose`),
  CONSTRAINT `email_otps_chk_1` CHECK ((`purpose` in (_utf8mb4'REGISTER',_utf8mb4'RESET_PASSWORD'))),
  CONSTRAINT `email_otps_chk_2` CHECK ((`used` in (0,1)))
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_otps`
--

LOCK TABLES `email_otps` WRITE;
/*!40000 ALTER TABLE `email_otps` DISABLE KEYS */;
/*!40000 ALTER TABLE `email_otps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `institution_profile`
--

DROP TABLE IF EXISTS `institution_profile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institution_profile` (
  `id` tinyint NOT NULL,
  `institution_name` varchar(255) NOT NULL,
  `address` text NOT NULL,
  `department_name` varchar(255) NOT NULL,
  `logo_path` varchar(512) DEFAULT NULL,
  `bonafide_title` varchar(255) NOT NULL DEFAULT 'BONAFIDE CERTIFICATE',
  `bonafide_body` text NOT NULL,
  `updated_by` varchar(64) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `institution_profile_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`username`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `institution_profile`
--

LOCK TABLES `institution_profile` WRITE;
/*!40000 ALTER TABLE `institution_profile` DISABLE KEYS */;
INSERT INTO `institution_profile` VALUES (1,'Visvesvaraya College of Engineering & Technology','Bongloor X Road, MP Patelguda (V), Ibrahimpatnam (M), Hyderabad-501510','DEPARTMENT OF CSE (DATA SCIENCE)','/api/files/students/logo.png','BONAFIDE CERTIFICATE','This is to certify that {student_name}, Hall Ticket No. {roll_no}, is a bonafide student of the {department} of this institution during the academic year {academic_year}. This certificate is issued at the request of the student for the purpose of {purpose}.','admin','2026-08-19 23:06:11');
/*!40000 ALTER TABLE `institution_profile` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `marks`
--

DROP TABLE IF EXISTS `marks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `marks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `roll_no` varchar(64) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `internal` double NOT NULL DEFAULT '0',
  `external` double NOT NULL DEFAULT '0',
  `entered_by` varchar(64) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roll_no` (`roll_no`,`subject`),
  KEY `idx_marks_roll` (`roll_no`),
  CONSTRAINT `marks_ibfk_1` FOREIGN KEY (`roll_no`) REFERENCES `students` (`roll_no`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `marks_chk_1` CHECK ((`internal` between 0 and 100)),
  CONSTRAINT `marks_chk_2` CHECK ((`external` between 0 and 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `marks`
--

LOCK TABLES `marks` WRITE;
/*!40000 ALTER TABLE `marks` DISABLE KEYS */;
/*!40000 ALTER TABLE `marks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `problem_reports`
--

DROP TABLE IF EXISTS `problem_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `problem_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(64) NOT NULL,
  `role` varchar(32) NOT NULL,
  `category` varchar(64) NOT NULL DEFAULT 'General',
  `subject` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'PENDING',
  `admin_notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `username` (`username`),
  CONSTRAINT `problem_reports_ibfk_1` FOREIGN KEY (`username`) REFERENCES `users` (`username`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `problem_reports_chk_1` CHECK ((`status` in (_utf8mb4'PENDING',_utf8mb4'IN_PROGRESS',_utf8mb4'RESOLVED',_utf8mb4'CLOSED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `problem_reports`
--

LOCK TABLES `problem_reports` WRITE;
/*!40000 ALTER TABLE `problem_reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `problem_reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `role` varchar(32) NOT NULL,
  `can_view_student_phone` tinyint(1) DEFAULT '1',
  `can_edit_students` tinyint(1) DEFAULT '1',
  `can_delete_students` tinyint(1) DEFAULT '1',
  `can_view_audit_logs` tinyint(1) DEFAULT '1',
  `can_view_sms_logs` tinyint(1) DEFAULT '1',
  `can_manage_calendar` tinyint(1) DEFAULT '1',
  `can_manage_subjects` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES ('FACULTY',1,1,0,0,0,1,1),('HOD',1,1,1,1,1,1,1);
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `key` varchar(191) NOT NULL,
  `value` text NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES ('academic_year','2024-25'),('attendance_threshold','75'),('department','CSD'),('institution_name','VCET CSD Student Management System'),('migrated_deactivate_year1','1'),('migrated_iii_i_calendar_doc','1'),('migrated_iii_i_current_semester','1'),('migrated_iii_i_timetable_doc','1'),('migration_student_semester_no_mass_overwrite_v2','1'),('open_student_registration','1'),('sms_daily_cap','62'),('sms_department_number','+916300743637'),('sms_enabled','1'),('sms_gateway_type','sim_modem'),('sms_modem_baud','115200'),('sms_modem_port','/dev/ttyUSB0'),('sms_repeat_every_attendance','1'),('student_semester_history_repair_v1','complete');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sms_gateways`
--

DROP TABLE IF EXISTS `sms_gateways`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sms_gateways` (
  `id` int NOT NULL AUTO_INCREMENT,
  `hod_username` varchar(64) NOT NULL,
  `gateway_name` varchar(128) NOT NULL DEFAULT 'SMSGate Phone',
  `gateway_mode` varchar(16) NOT NULL DEFAULT 'cloud',
  `device_id` varchar(255) DEFAULT NULL,
  `local_url` varchar(255) DEFAULT NULL,
  `username` varchar(128) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `modem_port` varchar(128) DEFAULT NULL,
  `modem_baud` varchar(32) DEFAULT '115200',
  `sim_number` tinyint DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hod_username` (`hod_username`),
  CONSTRAINT `sms_gateways_ibfk_1` FOREIGN KEY (`hod_username`) REFERENCES `users` (`username`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `sms_gateways_chk_1` CHECK ((`active` in (0,1)))
) ENGINE=InnoDB AUTO_INCREMENT=181 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sms_gateways`
--

LOCK TABLES `sms_gateways` WRITE;
/*!40000 ALTER TABLE `sms_gateways` DISABLE KEYS */;
INSERT INTO `sms_gateways` VALUES (1,'admin','admin SMSGate','cloud','mGEJ2fdchBcDEGKeH6xxZ','','4E3YMC','My1234@12VCETCSD','','115200',NULL,1,'2026-08-18 01:28:16','2026-08-20 01:10:38');
/*!40000 ALTER TABLE `sms_gateways` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sms_queue`
--

DROP TABLE IF EXISTS `sms_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sms_queue` (
  `id` int NOT NULL AUTO_INCREMENT,
  `roll_no` varchar(64) NOT NULL,
  `parent_phone` varchar(32) NOT NULL,
  `message` text NOT NULL,
  `attendance_session_id` int DEFAULT NULL,
  `send_date` varchar(32) NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'PENDING',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at` datetime DEFAULT NULL,
  `error` text,
  `hod_username` varchar(64) DEFAULT NULL,
  `gateway_id` int DEFAULT NULL,
  `approved` tinyint(1) NOT NULL DEFAULT '0',
  `attempt_count` int NOT NULL DEFAULT '0',
  `processing_started_at` datetime DEFAULT NULL,
  `provider_message_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roll_no` (`roll_no`,`send_date`),
  KEY `attendance_session_id` (`attendance_session_id`),
  KEY `idx_sms_queue_status` (`status`),
  KEY `idx_sms_queue_date` (`send_date`),
  KEY `idx_sms_queue_gateway` (`gateway_id`),
  KEY `idx_sms_queue_hod` (`hod_username`,`send_date`),
  KEY `idx_sms_queue_approval` (`approved`,`status`,`send_date`),
  CONSTRAINT `fk_sms_queue_gateway` FOREIGN KEY (`gateway_id`) REFERENCES `sms_gateways` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `sms_queue_ibfk_1` FOREIGN KEY (`roll_no`) REFERENCES `students` (`roll_no`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `sms_queue_ibfk_2` FOREIGN KEY (`attendance_session_id`) REFERENCES `attendance_sessions` (`id`),
  CONSTRAINT `sms_queue_chk_1` CHECK ((`status` in (_utf8mb4'PENDING',_utf8mb4'PROCESSING',_utf8mb4'SENT',_utf8mb4'FAILED')))
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sms_queue`
--

LOCK TABLES `sms_queue` WRITE;
/*!40000 ALTER TABLE `sms_queue` DISABLE KEYS */;
/*!40000 ALTER TABLE `sms_queue` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_semester_history`
--

DROP TABLE IF EXISTS `student_semester_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_semester_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `roll_no` varchar(64) NOT NULL,
  `semester_id` int NOT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `changed_by` varchar(64) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `semester_id` (`semester_id`),
  KEY `changed_by` (`changed_by`),
  KEY `idx_student_semester_history_roll` (`roll_no`,`effective_from`),
  CONSTRAINT `student_semester_history_ibfk_1` FOREIGN KEY (`roll_no`) REFERENCES `students` (`roll_no`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `student_semester_history_ibfk_2` FOREIGN KEY (`semester_id`) REFERENCES `academic_semesters` (`id`),
  CONSTRAINT `student_semester_history_ibfk_3` FOREIGN KEY (`changed_by`) REFERENCES `users` (`username`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_semester_history`
--

LOCK TABLES `student_semester_history` WRITE;
/*!40000 ALTER TABLE `student_semester_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `student_semester_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `students` (
  `id` int NOT NULL AUTO_INCREMENT,
  `roll_no` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `department` varchar(64) NOT NULL DEFAULT 'CSD',
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(32) DEFAULT NULL,
  `parent_phone` varchar(32) DEFAULT NULL,
  `dob` varchar(32) DEFAULT NULL,
  `address` text,
  `father_name` varchar(255) DEFAULT NULL,
  `category` varchar(64) DEFAULT NULL,
  `gender` varchar(32) DEFAULT NULL,
  `seat_category` varchar(64) DEFAULT NULL,
  `certificates_submitted` text,
  `certificates_due` text,
  `consultant_name` varchar(255) DEFAULT NULL,
  `photo_path` varchar(512) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `aadhaar_number` text,
  `apaar_id` text,
  `tenth_school` varchar(255) DEFAULT NULL,
  `tenth_year` varchar(32) DEFAULT NULL,
  `tenth_certificate_path` varchar(512) DEFAULT NULL,
  `twelfth_school` varchar(255) DEFAULT NULL,
  `twelfth_year` varchar(32) DEFAULT NULL,
  `twelfth_certificate_path` varchar(512) DEFAULT NULL,
  `diploma_college` varchar(255) DEFAULT NULL,
  `diploma_year` varchar(32) DEFAULT NULL,
  `diploma_certificate_path` varchar(512) DEFAULT NULL,
  `tenth_marks` varchar(32) DEFAULT NULL,
  `twelfth_marks` varchar(32) DEFAULT NULL,
  `diploma_marks` varchar(32) DEFAULT NULL,
  `current_semester_id` int DEFAULT NULL,
  `hod_username` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roll_no` (`roll_no`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_students_department` (`department`),
  KEY `idx_students_hod` (`hod_username`),
  CONSTRAINT `fk_students_hod_username` FOREIGN KEY (`hod_username`) REFERENCES `users` (`username`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `students_chk_1` CHECK ((`department` = _utf8mb4'CSD')),
  CONSTRAINT `students_chk_2` CHECK ((`active` in (0,1)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `students`
--

LOCK TABLES `students` WRITE;
/*!40000 ALTER TABLE `students` DISABLE KEYS */;
/*!40000 ALTER TABLE `students` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subject_faculty`
--

DROP TABLE IF EXISTS `subject_faculty`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subject_faculty` (
  `subject_id` int NOT NULL,
  `faculty_username` varchar(64) NOT NULL,
  PRIMARY KEY (`subject_id`,`faculty_username`),
  KEY `faculty_username` (`faculty_username`),
  CONSTRAINT `subject_faculty_ibfk_1` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `subject_faculty_ibfk_2` FOREIGN KEY (`faculty_username`) REFERENCES `users` (`username`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subject_faculty`
--

LOCK TABLES `subject_faculty` WRITE;
/*!40000 ALTER TABLE `subject_faculty` DISABLE KEYS */;
/*!40000 ALTER TABLE `subject_faculty` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subjects`
--

DROP TABLE IF EXISTS `subjects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subjects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `semester_id` int NOT NULL,
  `code` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `has_lab` tinyint(1) NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `semester_id` (`semester_id`,`code`),
  CONSTRAINT `subjects_ibfk_1` FOREIGN KEY (`semester_id`) REFERENCES `academic_semesters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `subjects_chk_1` CHECK ((`has_lab` in (0,1))),
  CONSTRAINT `subjects_chk_2` CHECK ((`active` in (0,1)))
) ENGINE=InnoDB AUTO_INCREMENT=1452 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subjects`
--

LOCK TABLES `subjects` WRITE;
/*!40000 ALTER TABLE `subjects` DISABLE KEYS */;
INSERT INTO `subjects` VALUES (1,4,'CSD221','Data Structures',0,1),(2,4,'CSD222','Database Systems',1,1),(3,4,'CSD223','Operating Systems',0,1),(4,4,'CSD224','Computer Networks',0,1),(5,4,'CSD225','Software Engineering',0,1),(6,4,'CSD226','Web Technologies',1,1),(7,5,'24CS501PC','Algorithms Design and Analysis',1,1),(8,5,'24CS502PC','Computer Networks',1,1),(9,5,'24CS503PC','Introduction to Data Science',1,1),(10,5,'24CS522PE','Software Project Management',0,1),(11,5,'24CS512PE','Artificial Intelligence',0,1),(12,5,'24MC510','Intellectual Property Rights',0,1),(13,5,'24CS508PC','Advanced English Communication Skills Laboratory',1,1),(40,1,'ZZQAE845EEC0DUP','ZZQA Duplicate Probe',0,1),(54,1,'ZZQA13A42C7FDUP','ZZQA Duplicate Probe',0,1),(68,1,'ZZQAFF9BEF25DUP','ZZQA Duplicate Probe',0,1),(83,1,'ZZQAF62AA8B5DUP','ZZQA Duplicate Probe',0,1),(98,1,'ZZQA89831864DUP','ZZQA Duplicate Probe',0,1),(126,1,'ZZQABC36ED16DUP','ZZQA Duplicate Probe',0,1),(154,1,'ZZQA0D5D5158DUP','ZZQA Duplicate Probe',0,1),(182,1,'ZZQA1E90D7EEDUP','ZZQA Duplicate Probe',0,1),(197,1,'ZZQA13BB73B6DUP','ZZQA Duplicate Probe',0,1),(212,1,'ZZQA85C924C7DUP','ZZQA Duplicate Probe',0,1),(227,1,'ZZQA7D1EAC1DDUP','ZZQA Duplicate Probe',0,1),(242,1,'ZZQAC2877181DUP','ZZQA Duplicate Probe',0,1),(257,1,'ZZQA813EF878DUP','ZZQA Duplicate Probe',0,1),(662,7,'00001','MAJOR PRO',1,1),(663,8,'00002','THE END',0,1),(742,1,'ZZQAA24CA6ADDUP','ZZQA Duplicate Probe',0,1),(848,7,'2CSERA','OLAP',0,1),(875,1,'ZZQA1CC225B5DUP','ZZQA Duplicate Probe',0,1),(890,1,'ZZQA01D2CBDADUP','ZZQA Duplicate Probe',0,1),(1048,1,'ZZQAB8F0A71DDUP','ZZQA Duplicate Probe',0,1),(1141,1,'ZZQA0E018655DUP','ZZQA Duplicate Probe',0,1),(1234,1,'ZZQA1F33B928DUP','ZZQA Duplicate Probe',0,1),(1327,1,'ZZQAD5481977DUP','ZZQA Duplicate Probe',0,1),(1394,1,'ZZQA7267B0FCDUP','ZZQA Duplicate Probe',0,1),(1409,1,'ZZQA531320E6DUP','ZZQA Duplicate Probe',0,1),(1437,1,'ZZQA3194E995DUP','ZZQA Duplicate Probe',0,1);
/*!40000 ALTER TABLE `subjects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_permissions`
--

DROP TABLE IF EXISTS `user_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_permissions` (
  `username` varchar(64) NOT NULL,
  `can_view_students` tinyint(1) DEFAULT '1',
  `can_edit_students` tinyint(1) DEFAULT '0',
  `can_delete_students` tinyint(1) DEFAULT '0',
  `can_manage_attendance` tinyint(1) DEFAULT '1',
  `can_manage_subjects` tinyint(1) DEFAULT '1',
  `can_manage_calendar` tinyint(1) DEFAULT '1',
  `can_view_sms_logs` tinyint(1) DEFAULT '0',
  `can_view_audit_logs` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`username`),
  CONSTRAINT `user_permissions_ibfk_1` FOREIGN KEY (`username`) REFERENCES `users` (`username`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_permissions`
--

LOCK TABLES `user_permissions` WRITE;
/*!40000 ALTER TABLE `user_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(64) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(32) NOT NULL,
  `student_roll_no` varchar(64) DEFAULT NULL,
  `full_name` varchar(255) NOT NULL DEFAULT '',
  `photo_path` varchar(512) DEFAULT NULL,
  `department` varchar(64) DEFAULT NULL,
  `designation` varchar(128) DEFAULT NULL,
  `employee_id` varchar(64) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `phone` varchar(32) DEFAULT NULL,
  `qualification` varchar(255) DEFAULT NULL,
  `date_of_joining` varchar(32) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `must_change_password` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `hod_username` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `student_roll_no` (`student_roll_no`),
  KEY `idx_users_hod` (`hod_username`),
  CONSTRAINT `fk_users_hod_username` FOREIGN KEY (`hod_username`) REFERENCES `users` (`username`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`student_roll_no`) REFERENCES `students` (`roll_no`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `users_chk_1` CHECK ((`role` in (_utf8mb4'HOD',_utf8mb4'FACULTY',_utf8mb4'STUDENT'))),
  CONSTRAINT `users_chk_2` CHECK ((`email_verified` in (0,1))),
  CONSTRAINT `users_chk_3` CHECK ((`active` in (0,1))),
  CONSTRAINT `users_chk_4` CHECK ((`must_change_password` in (0,1)))
) ENGINE=InnoDB AUTO_INCREMENT=184 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','pbkdf2_sha256$200000$602101f4b98206579a15d0ebcbfc9d51$1b78c605dc403728f383cb46bea94b45053be4cead9f06c2a0a598c7de0a3b6d','HOD',NULL,'CSD Head of Department',NULL,'CSD','Head of Department','',NULL,0,'','','',1,0,'2026-08-14 01:04:38','admin'),(182,'Srikanth','pbkdf2_sha256$200000$f42ef10496ddde72e42bee800d8289d6$b2e6bbe955e29b0522f375c818cbd1b54e2555530c137241cea4dd4969010f8f','HOD',NULL,'Srikanth@2026',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,1,0,'2026-08-20 22:26:25','Srikanth');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'student_management'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-21 10:57:28
