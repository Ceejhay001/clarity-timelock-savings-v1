;; Time-locked savings account contract

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_OWNER_ONLY (err u100))
(define-constant ERR_INVALID_AMOUNT (err u101))
(define-constant ERR_NO_SAVINGS (err u102))
(define-constant ERR_LOCK_NOT_EXPIRED (err u103))
(define-constant PENALTY_RATE u10) ;; 10% penalty for early withdrawal

;; Data vars
(define-map savings
    principal
    {
        amount: uint,
        lock-until: uint,
        start-height: uint
    }
)

;; Private functions
(define-private (calculate-penalty (amount uint))
    (/ (* amount PENALTY_RATE) u100)
)

;; Public functions
(define-public (deposit (lock-duration uint))
    (let 
        (
            (amount (stx-get-balance tx-sender))
            (current-height block-height)
            (lock-until (+ block-height lock-duration))
        )
        (asserts! (> amount u0) ERR_INVALID_AMOUNT)
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
        (map-set savings tx-sender {
            amount: amount,
            lock-until: lock-until,
            start-height: current-height
        })
        (ok true)
    )
)

(define-public (withdraw)
    (let 
        (
            (savings-data (unwrap! (map-get? savings tx-sender) ERR_NO_SAVINGS))
            (current-height block-height)
            (amount (get amount savings-data))
            (lock-until (get lock-until savings-data))
        )
        (if (>= current-height lock-until)
            ;; Normal withdrawal - no penalty
            (begin
                (map-delete savings tx-sender)
                (as-contract (stx-transfer? amount (as-contract tx-sender) tx-sender))
                (ok true)
            )
            ;; Early withdrawal - apply penalty
            (let
                (
                    (penalty (calculate-penalty amount))
                    (withdrawal-amount (- amount penalty))
                )
                (map-delete savings tx-sender)
                (as-contract (stx-transfer? withdrawal-amount (as-contract tx-sender) tx-sender))
                (as-contract (stx-transfer? penalty (as-contract tx-sender) CONTRACT_OWNER))
                (ok true)
            )
        )
    )
)

;; Read only functions
(define-read-only (get-savings (account principal))
    (map-get? savings account)
)

(define-read-only (get-penalty-rate)
    PENALTY_RATE
)
