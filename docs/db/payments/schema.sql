--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    invoicable_type character varying(120) NOT NULL,
    invoicable_id integer NOT NULL,
    type character varying(80) NOT NULL,
    value numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;

--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;

--
-- Name: payment_event_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_event_outbox (
    event_id uuid NOT NULL,
    command_message_id uuid NOT NULL,
    correlation_id uuid NOT NULL,
    type character varying(120) NOT NULL,
    version smallint NOT NULL,
    source character varying(120) NOT NULL,
    occurred_at timestamp without time zone NOT NULL,
    payload jsonb NOT NULL,
    published_at timestamp without time zone,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    claimed_at timestamp without time zone,
    claim_token uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Name: payment_job_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_job_receipts (
    message_id uuid NOT NULL,
    correlation_id uuid NOT NULL,
    command_type character varying(120) NOT NULL,
    status character varying(20) NOT NULL,
    payload jsonb NOT NULL,
    result jsonb,
    failure_code character varying(120),
    failure_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);

--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);

--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);

--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);

--
-- Name: invoices invoices_source_type_id_type_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_source_type_id_type_unique UNIQUE (invoicable_type, invoicable_id, type);

--
-- Name: payment_event_outbox payment_event_outbox_command_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_event_outbox
    ADD CONSTRAINT payment_event_outbox_command_message_id_key UNIQUE (command_message_id);

--
-- Name: payment_event_outbox payment_event_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_event_outbox
    ADD CONSTRAINT payment_event_outbox_pkey PRIMARY KEY (event_id);

--
-- Name: payment_job_receipts payment_job_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_job_receipts
    ADD CONSTRAINT payment_job_receipts_pkey PRIMARY KEY (message_id);

--
-- Name: payment_event_outbox_correlation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_event_outbox_correlation_id_idx ON public.payment_event_outbox USING btree (correlation_id);

--
-- Name: payment_event_outbox_ready_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_event_outbox_ready_idx ON public.payment_event_outbox USING btree (published_at, claimed_at);

--
-- Name: payment_job_receipts_correlation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_job_receipts_correlation_id_idx ON public.payment_job_receipts USING btree (correlation_id);

--
-- PostgreSQL database dump complete
--
