import express, { response } from 'express'
import { Guid } from 'guid-typescript'
import {
  paypalTransactions,
  TransactionDetailsEntity,
} from '../../entity/PaypalTransaction'
import { ClientRequest } from 'http'

import axios from 'axios'
import { resolve, URLSearchParams } from 'url'
import { PaypalToken } from '../models/paypal'
import { Transaction } from '../../entity/transaction'
import { Member, ROLES } from '../../entity/member'
import { AppDataSource } from '../../app'
const router = express.Router()

function getPaypalToken(): Promise<PaypalToken> {
  return Promise.reject(new Error('PayPal access is disabled in local development'))
}

function getPaypalData(token: string): Promise<paypalTransactions> {
  return new Promise((resolve, reject) => {
    const endDate: Date = new Date(Date.now())
    const startDate: Date = new Date()
    startDate.setDate(endDate.getDate() - 31)

    let payPalStartDate =
      startDate.getFullYear() +
      '-' +
      (startDate.getMonth() + 1) +
      '-' +
      startDate.getDate()

    let payPalEndDate =
      endDate.getFullYear() +
      '-' +
      (endDate.getMonth() + 1) +
      '-' +
      endDate.getDate()

    //in case we need to get old transactions
    //payPalStartDate = '2024-12-1';
    //payPalEndDate = '2024-12-31';

    const url = `https://api-m.paypal.com/v1/reporting/transactions?start_date=${payPalStartDate}T00:00:00-0500&end_date=${payPalEndDate}T00:00:00-0500&fields=all&page_size=500`

    const config = {
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: '*/*',
        'Content-Type': 'application/json',
      },
    }

    axios
      .get(url, config)
      .then(function (response) {
        resolve(response.data)
      })
      .catch(function (error) {
        reject(error)
      })
  })
}

function processPayments(paypalData: paypalTransactions) {
  //https://developer.paypal.com/docs/api/transaction-search/v1/

  let transmap =
  paypalData.transaction_details.filter(t => t.transaction_info.transaction_subject)
  .filter(t => t.transaction_info.transaction_subject!.toLowerCase().indexOf('membership') >= 0)
    .map((tran: TransactionDetailsEntity) => {
      let name = ''
      if (tran.payer_info.payer_name) {
        name =
          tran.payer_info.payer_name.given_name +
          ',' +
          tran.payer_info.payer_name.surname
      } else {
        name =
          tran.shipping_info.name.split(',')[1] +
          ',' +
          tran.shipping_info.name.split(',')[0]
      }

      return {
        id: tran.transaction_info.transaction_id,
        amount: tran.transaction_info.transaction_amount.value,
        transactionDate: tran.transaction_info.transaction_initiation_date,
        description: tran.transaction_info.transaction_status,
        method: 'PayPal',
        paypalEmail: tran.payer_info.email_address,
        paypalMemberId: tran.payer_info.account_id,
        paypalName: name,
        type: tran.transaction_info.paypal_reference_id_type,
      }
    })

  transmap.forEach(async (tran) => {
    const pp: Transaction = JSON.parse(JSON.stringify(tran))

    const member = new Member()

    console.log('processing:', pp.paypalEmail)

    await member.GetMemberByPaypalEmail(pp.paypalEmail).then(async (result) => {
      if (result.id) {
        //we found a member because id is not null
        pp.memberId = result.id
      } else {
        //create a new member
        member.firstName = pp.paypalName.split(',')[0]
        member.lastName = pp.paypalName.split(',')[1]
        member.role = ROLES.MEMBER
        member.email = pp.paypalEmail
        member.paypalEmail = pp.paypalEmail
        member.id = Guid.create().toString()
        AppDataSource.manager.insert(Member, member).then(
          (insertResult) => {
            pp.memberId = member.id
            console.log('created member')
          },
          (err) => {
            throw err
          }
        )
      }
    })

    await AppDataSource.manager.save(Transaction, pp).then((result) => {
      console.log('tranaction Saved:', result)
    })

    member.updateAllMemberBalancesAndStatus()
  })
}

router.get('/update', (req, res) => {
  getPaypalToken().then(
    (token) => {
      getPaypalData(token.access_token)
        .then((trans) => {
          processPayments(trans)

          res.status(200).json(trans)
        })
        .catch((err) => res.status(500).json(err))
    },
    (err) => {
      res.status(500).json(err)
    }
  )
})

module.exports = router
