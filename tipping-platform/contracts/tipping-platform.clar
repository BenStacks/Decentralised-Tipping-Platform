;; ;; ;; Title: Tip-stacks 
;; ;; ;; Description: Decentralized tipping platform with advanced features

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;; Constants ;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(define-constant CONTRACT_OWNER 'STFPYA06K2F5BY0ESPY7HMK70WEAEXBFF20HGPYX)
(define-constant PLATFORM_FEE_PERCENTAGE u5)
(define-constant MAX_TIP_AMOUNT u1000000000)  ;; 1000 STX
(define-constant REWARD_THRESHOLD u1000000)   ;; 1 STX
(define-constant REWARD_RATE u10)
(define-constant ALLOWED_TOKENS (list 
    "STX" 
    "BTC" 
))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;  Error codes  ;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;


(define-constant ERR_INSUFFICIENT_FUNDS (err u1))
(define-constant ERR_INVALID_AMOUNT (err u2))
(define-constant ERR_TRANSFER_FAILED (err u3))
(define-constant ERR_REWARD_UPDATE_FAILED (err u4))

;; Added new error constants
(define-constant ERR_INVALID_USERNAME (err u8))
(define-constant ERR_INVALID_USERNAME_LENGTH (err u9))
(define-constant ERR_USERNAME_TAKEN (err u10))
(define-constant ERR_UNAUTHORIZED (err u6))
(define-constant ERR_INVALID_REWARD_RATE (err u7))
(define-constant MAX_REWARD_RATE u100)
(define-constant ERR_INVALID_TOKEN_TYPE (err u11))
(define-constant ERR_INVALID_RECIPIENT (err u5))
;; Add new error constant for invalid user
(define-constant ERR_INVALID_USER (err u12))
