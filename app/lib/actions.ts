'use server';

import {z} from 'zod';
import {sql} from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import {redirect} from 'next/navigation'
import {signIn} from '@/auth';
import {AuthError} from 'next-auth'

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0.' }),  
    // coerce (change) from string to number then validate
    //coercing the amount type from string to number, it'll default to zero if the string is empty.
    //tell Zod we always want the amount greater than 0 with the .gt() function.
    status: z.enum(['pending', 'paid'],{invalid_type_error: 'Please select an invoice status.',}),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({id:true, date:true})

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

//.get(name) method.
export async function createInvoice(prevState:State, formData: FormData) {
    //const rawFormData = {
    //const { customerId, amount, status } = CreateInvoice.parse({

    //return an object containing either a success or error field
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    console.log(validatedFields);
    console.log(validatedFields.error && validatedFields.error.flatten());

  // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
        return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;

    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];
    // Test it out:
    //console.log(rawFormData);
    //console.log(typeof rawFormData.amount);  //input elements with type="number" actually return a string, not a number!
    //console.log(new Date().toISOString())
    try
    { await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    }
    catch (error){
        return {
            message: 'Database Error: Failed to Create Invoice.',
        };
    }
    
    revalidatePath('/dashboard/invoices');  //Once the database has been updated, the /dashboard/invoices path will be revalidated, and fresh data will be fetched from the server.
    redirect('/dashboard/invoices')
}

//prevState var is needed for the useActionState
export async function updateInvoice(id: string, prevState: State, formData:FormData)
{
    //const {customerId, amount, status} = UpdateInvoice.parse({
    //return an object containing either a success or error field
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    })

    
  // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
        return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to Update Invoice.',
        };
    }

    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;

    const amountInCents= amount*100;
    try{
    await sql`
        UPDATE invoices
        SET customer_id=${customerId}, amount = ${amountInCents}, status=${status}
        WHERE id = ${id}
    `} catch (error) {
        return {
            message: 'Database Error: Failed to Update Invoice.' 
        }
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice (id:string)
{
    //throw early error
    //throw new Error('Failed to Delete Invoice');

    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
    } catch (error){
        return {message: 'Database Error: Failed to Delete Invoice.'}
    }
    revalidatePath('/dashboard/invoices');
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
    await signIn('credentials', formData);
    } catch (error) {
    if (error instanceof AuthError) {
        switch (error.type) {
        case 'CredentialsSignin':
            return 'Invalid credentials.';
        default:
            return 'Something went wrong.';
        }
    }
    throw error;
    }
}
  